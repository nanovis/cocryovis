import { MainModule } from "./wasmInterface";

declare global {
  interface Window {
    createVolumeRenderer: (options: any) => Promise<MainModule>;
    WasmModule: MainModule | null;
  }
}
