interface Navigator {
  gpu: GPU | undefined;
}

interface GPU {
  requestAdapter(
    options?: GPURequestAdapterOptions
  ): Promise<GPUAdapter | null>;
}

interface GPUAdapter {
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

interface GPUDevice {}
