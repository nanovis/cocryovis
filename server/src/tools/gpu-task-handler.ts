import { ApiError } from "./error-handler.mjs";
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
    if (!this.canRunTask()) {
      throw new ApiError(
        400,
        "Failed Attempt to start inference: Too many tasks in queue."
      );
    }
    return await this.taskQueue.enqueue(() => task());
  }
}
