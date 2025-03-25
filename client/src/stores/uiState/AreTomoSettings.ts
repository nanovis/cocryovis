export class AreTomoSettings {
  // ----- General Settings -----
  totalDose: number = 120; // e.g. -DoseTotal
  tiltAxis: number = 0; // -TiltAxis
  alignZ: number = 300; // -AlignZ
  volZ: number = 300; // -VolZ
  binningFactor: number = 1; // -Bin

  // ----- Motion Correction -----
  gainReferencePath?: string; // -Gain
  darkReferencePath?: string; // -Dark
  defectFile?: string; // -Defect
  patchSize: number = 5; // -Patch
  iterations: number = 5; // -Iter
  tolerance: number = 0.1; // -Tol

  // ----- CTF Estimation -----
  amplitudeContrast: number = 0.07; // -AmpCont
  ctfCorrection: string = "PhaseFlip"; // -CTFCorr (e.g. PhaseFlip)
  defocusHandling: string = "default"; // -Defocus (e.g. default, average, gradient)

  constructor(init?: Partial<AreTomoSettings>) {
    Object.assign(this, init);
  }

  toCommandArgs(): string[] {
    const args = [
      `-DoseTotal`, `${this.totalDose}`,
      `-TiltAxis`, `${this.tiltAxis}`,
      `-AlignZ`, `${this.alignZ}`,
      `-VolZ`, `${this.volZ}`,
      `-Bin`, `${this.binningFactor}`,
      `-Patch`, `${this.patchSize}`,
      `-Iter`, `${this.iterations}`,
      `-Tol`, `${this.tolerance}`,
      `-AmpCont`, `${this.amplitudeContrast}`,
      `-CTFCorr`, `${this.ctfCorrection}`,
      `-Defocus`, `${this.defocusHandling}`
    ];

    if (this.gainReferencePath) args.push(`-Gain`, this.gainReferencePath);
    if (this.darkReferencePath) args.push(`-Dark`, this.darkReferencePath);
    if (this.defectFile) args.push(`-Defect`, this.defectFile);

    return args;
  }
}
