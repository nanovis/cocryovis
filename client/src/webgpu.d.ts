import { MainModule } from "./wasmInterface";

declare global {
  interface Navigator {
    gpu: GPU | undefined;
  }

  interface GPU {
    requestAdapter(
      options?: GPURequestAdapterOptions
    ): Promise<GPUAdapter | null>;
  }

  interface GPUAdapter {
    limits: any,
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
  }

  interface GPUDevice {}

  interface Window {
    createVolumeRenderer: (options: any) => Promise<MainModule>;
    WasmModule: MainModule | null;
  }
}
