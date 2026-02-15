import { ApiError } from "./error-handler.mjs";
import TaskQueue, { Task } from "./task-queue";
import Utils from "./utils.mjs";

export abstract class GPUTask<T = unknown> extends Task<T> {
  protected gpuManager: GPUTaskHandler;
  protected gpuId: number | null = null;

  constructor(userId: number, gpuManager: GPUTaskHandler) {
    super(userId);
    this.gpuManager = gpuManager;
  }

  override async reserveResources(): Promise<boolean> {
    try {
      this.acquireGPU();
      return true;
    } catch (error) {
      return false;
    }
  }

  override async onEnd(): Promise<void> {
    this.releaseGPU();
  }

  override canRun(): boolean {
    return this.gpuManager.isGpuAvailable();
  }

  protected acquireGPU(): number {
    const gpuId = this.gpuManager.requestGPU();
    if (gpuId === null) {
      throw new ApiError(503, "No available GPU resources.");
    }
    this.gpuId = gpuId;
    return gpuId;
  }

  protected releaseGPU(): void {
    if (this.gpuId !== null) {
      this.gpuManager.releaseGPU(this.gpuId);
      this.gpuId = null;
    }
  }
}

export default class GPUTaskHandler {
  private taskQueue: TaskQueue;
  private config: AppConfig;
  private gpuData: GPUData[] = [];
  private availableGpus: Set<number> = new Set();

  private constructor(config: AppConfig) {
    this.config = config;
    this.taskQueue = new TaskQueue(0);
  }

  static async create(config: AppConfig): Promise<GPUTaskHandler> {
    const handler = new GPUTaskHandler(config);
    await handler.initialize();
    return handler;
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

  isGpuAvailable() {
    return this.availableGpus.size > 0;
  }

  isTaskRunning() {
    return this.taskQueue.hasActiveTask;
  }

  canRunTask() {
    return this.taskQueue.size < this.config.gpuQueueSize;
  }

  async queueGPUTask<T>(task: Task<T>) {
    if (!this.canRunTask()) {
      throw new ApiError(
        400,
        "Failed Attempt to start inference: Too many tasks in queue or GPU not ready."
      );
    }
    return await this.taskQueue.enqueue(task);
  }
}
