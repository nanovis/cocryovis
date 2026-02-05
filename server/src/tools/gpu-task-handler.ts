import TaskQueue from "./task-queue";
export default class GPUTaskHandler {
  private taskQueue: TaskQueue;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    this.taskQueue = new TaskQueue();
    Object.preventExtensions(this);
  }

  isTaskRunning() {
    return this.taskQueue.hasPendingTask;
  }

  canRunTask() {
    return this.taskQueue.size < this.config.gpuQueueSize;
  }

  async queueGPUTask<T>(task: () => Promise<T>) {
    return await this.taskQueue.enqueue(() => task());
  }
}
