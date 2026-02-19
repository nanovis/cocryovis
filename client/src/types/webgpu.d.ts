import type { MainModule } from "./wasmInterface";

declare global {
  interface Window {
    createVolumeRenderer: (options: unknown) => Promise<MainModule>;
    WasmModule: MainModule | null;
  }
}
