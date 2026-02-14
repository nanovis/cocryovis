export type TaskAction<T> = () => Promise<T>;

export interface Task<T = unknown> {
  action: TaskAction<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}
export default class TaskQueue {
  private queue: Task[] = [];
  private activeCount = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  get size(): number {
    return this.queue.length;
  }

  get hasPendingTask(): boolean {
    return this.activeCount > 0;
  }

  setMaxConcurrency(maxConcurrency: number): void {
    this.maxConcurrency = maxConcurrency;
    void this.dequeue();
  }

  enqueue<T>(action: TaskAction<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ action, resolve, reject });
      void this.dequeue();
    });
  }

  private async dequeue(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency) return;

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;

    try {
      const payload = await task.action();
      task.resolve(payload);
    } catch (error) {
      task.reject(error);
    } finally {
      this.activeCount--;
      void this.dequeue();
    }
  }

  clear(): void {
    this.queue.length = 0;
  }
}
