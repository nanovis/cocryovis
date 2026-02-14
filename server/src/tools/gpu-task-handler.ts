import { ApiError } from "./error-handler.mjs";
import TaskQueue from "./task-queue";
import Utils from "./utils.mjs";
export default class GPUTaskHandler {
  private taskQueue: TaskQueue;
  private config: AppConfig;
  private ready: boolean = false;
  private gpuData: GPUData[] = [];
  private availableGpus: Set<number> = new Set();

  constructor(config: AppConfig) {
    this.config = config;
    this.taskQueue = new TaskQueue(0);
    this.initialize().catch((err) => {
      console.error("Failed to initialize GPUTaskHandler:", err);
    });
  }

  private async initialize() {
    const gpuDataJson = await Utils.runPythonScriptWithOutput(
      "get-gpu-data.py",
      []
    );
    this.gpuData = JSON.parse(gpuDataJson) as GPUData[];
    if (this.gpuData.length === 0) {
      console.warn("No GPU devices found, GPU functionality will be disabled.");
    } else {
      console.log("GPU Data:", this.gpuData);
    }
    this.availableGpus = new Set(this.gpuData.map((gpu) => gpu.device_id));
    this.taskQueue.setMaxConcurrency(this.gpuData.length);
    this.ready = true;
  }

  requestGPU(): number | null {
    for (const gpuId of this.availableGpus) {
      this.availableGpus.delete(gpuId);
      return gpuId;
    }
    return null;
  }

  releaseGPU(gpuId: number): void {
    this.availableGpus.add(gpuId);
  }

  getGPUStatus() {
    return {
      freeGpus: this.availableGpus.size,
      totalGpus: this.gpuData.length,
    };
  }

  isTaskRunning() {
    return this.taskQueue.hasPendingTask;
  }

  canRunTask() {
    return this.ready && this.taskQueue.size < this.config.gpuQueueSize;
  }

  async queueGPUTask<T>(task: () => Promise<T>) {
    if (!this.canRunTask()) {
      throw new ApiError(
        400,
        "Failed Attempt to start inference: Too many tasks in queue or GPU not ready."
      );
    }
    return await this.taskQueue.enqueue(() => task());
  }
}
