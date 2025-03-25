export class MotionCorrectionSettings {
  patchSizeX: number = 5; // From -Patch X Y
  patchSizeY: number = 5;
  binningFactor: number = 1; // From -FtBin
  enableDoseWeighting: boolean = false; // Enables -Kv, -PixSize, -FmDose if true
  voltageKV?: number; // -Kv (e.g. 300)
  pixelSize?: number; // -PixSize (e.g. 0.5)
  frameDose?: number; // -FmDose (e.g. 1.2)
  throwFrames: number = 0; // -Throw
  truncateFrames: number = 0; // -Trunc
  iterations: number = 10; // -Iter
  tolerance: number = 0.5; // -Tol
  gainReferencePath?: string; // -Gain
  darkReferencePath?: string; // -Dark
  outputBinningMode: number = 1; // Output binning, defaults to 1 (no binning)
  outputStack: boolean = false; // -OutStack 1

  constructor(init?: Partial<MotionCorrectionSettings>) {
    Object.assign(this, init);
  }

  toCommandArgs(): string[] {
    const args = [
      `-Patch`, `${this.patchSizeX}`, `${this.patchSizeY}`,
      `-FtBin`, `${this.binningFactor}`,
      `-Iter`, `${this.iterations}`,
      `-Tol`, `${this.tolerance}`,
      `-Throw`, `${this.throwFrames}`,
      `-Trunc`, `${this.truncateFrames}`,
    ];

    if (this.enableDoseWeighting && this.voltageKV && this.pixelSize && this.frameDose) {
      args.push(`-Kv`, `${this.voltageKV}`);
      args.push(`-PixSize`, `${this.pixelSize}`);
      args.push(`-FmDose`, `${this.frameDose}`);
    }

    if (this.gainReferencePath) args.push(`-Gain`, this.gainReferencePath);
    if (this.darkReferencePath) args.push(`-Dark`, this.darkReferencePath);
    if (this.outputStack) args.push(`-OutStack`, `1`);

    return args;
  }
}
