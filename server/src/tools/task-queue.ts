import TaskHistory from "../models/task-history.mjs";
import LogFile from "./log-manager.mjs";

export type TaskAction<T> = () => Promise<T>;

export abstract class Task<T = unknown> {
  protected userId: number;
  protected taskHistory?: TaskHistoryDB;
  protected logFile?: LogFile;
  protected abstract logName: string;

  protected constructor(userId: number) {
    this.userId = userId;
  }

  // Typescript black magic to allow async constructors in subclasses. Affront to god and country.
  // static async create<DerivedTask extends Task<any>, Args extends any[]>(
  //   this: new (...args: Args) => DerivedTask,
  //   ...args: Args
  // ): Promise<DerivedTask> {
  //   const task = new this(...args);
  //   await task.onQueued();
  //   return task;
  // }

  protected abstract taskHistoryData(): RequireFields<
    Parameters<typeof TaskHistory.create>[0],
    "taskType"
  >;

  // ---- lifecycle ----
  public abstract execute(): Promise<T>;

  public canRun?(): boolean;

  public reserveResources?(): boolean | Promise<boolean>;

  public async beforeStart(): Promise<void> {
    if (!this.taskHistory) {
      throw new Error("Task history is not set");
    }
    this.logFile = await LogFile.createLogFile(this.logName);
    await TaskHistory.update(this.taskHistory.id, {
      taskStatus: TaskHistory.status.running,
      startTime: new Date(),
      logFile: this.logFile.fileName,
    });
  }

  public async onSuccess(_result: T): Promise<void> {
    if (!this.taskHistory) {
      throw new Error("Task history is not set");
    }
    await TaskHistory.update(this.taskHistory.id, {
      taskStatus: TaskHistory.status.finished,
      endTime: new Date(),
    });
  }

  public async onFailure(_error: unknown): Promise<void> {
    if (!this.taskHistory) {
      throw new Error("Task history is not set");
    }
    await TaskHistory.update(this.taskHistory.id, {
      taskStatus: TaskHistory.status.failed,
      endTime: new Date(),
    });
  }

  public onEnd?(): void | Promise<void>;

  public async onQueued(): Promise<void> {
    this.taskHistory = await TaskHistory.create({
      userId: this.userId,
      taskType: TaskHistory.type.Inference,
      taskStatus: TaskHistory.status.enqueued,
      enqueuedTime: new Date(),
      ...this.taskHistoryData?.(),
    });
  }
}

interface QueuedTask<T = unknown> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export default class TaskQueue {
  private queue: QueuedTask[] = [];
  private activeCount = 0;
  private maxConcurrency: number;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  get size(): number {
    return this.queue.length;
  }

  get hasActiveTask(): boolean {
    return this.activeCount > 0;
  }

  private startPolling() {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(() => {
      if (this.queue.length === 0 && this.activeCount === 0) {
        this.stopPolling();
        return;
      }
      void this.dequeue();
    }, 1000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  setMaxConcurrency(maxConcurrency: number): void {
    this.maxConcurrency = maxConcurrency;
    void this.dequeue();
  }

  async enqueue<T>(task: Task<T>): Promise<T> {
    this.startPolling();

    return new Promise<T>((resolve, reject) => {
      Promise.resolve()
        .then(() => task.onQueued?.())
        .then(() => {
          this.queue.push({ task, resolve, reject });
          void this.dequeue();
        })
        .catch(reject);
    });
  }

  private async dequeue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency) return;

    // Find the first task that can run
    const queuedTask = this.queue.find(
      (qt) => !qt.task.canRun || qt.task.canRun()
    );
    if (!queuedTask) return;

    const canReserve = await queuedTask.task.reserveResources?.();
    if (canReserve === false) {
      // If resources are not available, do not dequeue this task
      return;
    }

    this.queue.splice(this.queue.indexOf(queuedTask), 1);
    const { task, resolve, reject } = queuedTask;
    this.activeCount++;

    try {
      await task.beforeStart?.();
      const payload = await task.execute();
      try {
        await task.onSuccess?.(payload);
      } catch (afterError) {
        console.error("Error in onSuccess:", afterError);
      }
      resolve(payload);
    } catch (error) {
      try {
        await task.onFailure?.(error);
      } catch (failureError) {
        console.error("Error in onFailure:", failureError);
      }
      reject(error);
    } finally {
      try {
        await task.onEnd?.();
      } catch (endError) {
        console.error("Error in onEnd:", endError);
      }
      this.activeCount--;
      void this.dequeue();
    }
  }

  clear(): void {
    this.queue.length = 0;
  }
}
