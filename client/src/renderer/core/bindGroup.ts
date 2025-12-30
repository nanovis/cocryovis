import { WebGpuBuffer } from "./webGpuBuffer";
import type { WebGpuTexture } from "./webGpuTexture";

class BindGroupEntry {
  private bindGroupLayoutEntry: GPUBindGroupLayoutEntry;
  private resource: WebGpuBuffer | WebGpuTexture | null = null;

  private current: GPUBindGroupEntry | undefined;

  constructor(bindGroupLayoutEntry: GPUBindGroupLayoutEntry) {
    this.bindGroupLayoutEntry = bindGroupLayoutEntry;
  }

  setResource(resource: typeof this.resource) {
    this.resource = resource;
  }

  getBindingIndex() {
    return this.bindGroupLayoutEntry.binding;
  }

  getResourceEntry(): GPUBindingResource | undefined {
    if (!this.resource) {
      console.warn(`No resource set for binding ${this.getBindingIndex()}.`);
      return undefined;
    }

    if (this.resource instanceof WebGpuBuffer) {
      return this.resource.getBuffer();
    }
    if (this.bindGroupLayoutEntry.sampler !== undefined) {
      return this.resource.getSampler();
    } else {
      return this.resource.getView();
    }
  }

  getGPUBindGroupEntry(): {
    entry: GPUBindGroupEntry | undefined;
    updated: boolean;
  } {
    const resourceEntry = this.getResourceEntry();
    if (!resourceEntry) return { entry: undefined, updated: false };
    if (resourceEntry === this.current?.resource)
      return { entry: this.current, updated: false };

    const bindGroupEntry: GPUBindGroupEntry = {
      binding: this.getBindingIndex(),
      resource: resourceEntry,
    };
    this.current = bindGroupEntry;
    return { entry: bindGroupEntry, updated: true };
  }
}

export class BindGroup {
  private readonly bindGroupEntries: BindGroupEntry[] = [];
  private readonly bindGroupLayout: GPUBindGroupLayout;
  private gpuBindGroup: GPUBindGroup | undefined;
  private device: GPUDevice;

  constructor(
    device: GPUDevice,
    bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor
  ) {
    this.device = device;
    const usedBindings = new Set<number>();
    for (const entry of bindGroupLayoutDescriptor.entries) {
      if (usedBindings.has(entry.binding)) {
        throw new Error(
          `Duplicate binding ${entry.binding} in BindGroupLayoutDescriptor.`
        );
      }
      usedBindings.add(entry.binding);
      this.bindGroupEntries.push(new BindGroupEntry(entry));
    }
    this.bindGroupLayout = this.device.createBindGroupLayout(
      bindGroupLayoutDescriptor
    );
  }

  setResource(binding: number, resource: WebGpuBuffer | WebGpuTexture | null) {
    const entry = this.bindGroupEntries.find(
      (e) => e.getBindingIndex() === binding
    );
    if (!entry) {
      throw new Error(`Binding ${binding} not found in BindGroup.`);
    }
    entry.setResource(resource);
  }

  getBindGroupLayout(): GPUBindGroupLayout {
    return this.bindGroupLayout;
  }

  getGPUBindGroup(): GPUBindGroup | undefined {
    const entries: GPUBindGroupEntry[] = [];
    let dirty = false;
    for (const entry of this.bindGroupEntries) {
      const { entry: gpuEntry, updated } = entry.getGPUBindGroupEntry();
      if (!gpuEntry) return undefined;
      dirty = dirty || updated;
      entries.push(gpuEntry);
    }
    if (!dirty && this.gpuBindGroup) {
      return this.gpuBindGroup;
    }

    this.gpuBindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: entries,
    });
    return this.gpuBindGroup;
  }
}
