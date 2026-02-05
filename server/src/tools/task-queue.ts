import Utils from "./utils.mjs";

type TaskAction<T> = () => Promise<T>;

interface Task<T = unknown> {
  action: TaskAction<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export default class TaskQueue {
  #queue: Task[] = [];
  private pendingProcess = false;

  get size(): number {
    return this.#queue.length;
  }

  get hasPendingTask(): boolean {
    return this.pendingProcess;
  }

  enqueue<T>(action: TaskAction<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#queue.push({ action, resolve, reject });

      this.dequeue().catch((error: unknown) => {
        const errorMessage = Utils.formatError(error);
        console.error("Error processing task queue:", errorMessage);
      });
    });
  }

  private async dequeue(): Promise<boolean> {
    if (this.pendingProcess) return false;

    // Keep task in queue until it's fully processed
    const task = this.#queue[0];
    if (!task) return false;

    this.pendingProcess = true;

    try {
      const payload = await task.action();
      task.resolve(payload);
    } catch (error) {
      task.reject(error);
    } finally {
      this.pendingProcess = false;
      this.#queue.shift();
      void this.dequeue();
    }

    return true;
  }

  clear(): void {
    this.#queue.length = 0;
  }
}
