import Utils from "./Utils";

type Vector3 = { x: number; y: number; z: number };

export class VolumeSettings {
  file?: string;
  size?: Vector3;
  ratio: Vector3 = { x: 1, y: 1, z: 1 };
  bytesPerVoxel?: number;
  usedBits?: number;
  skipBytes: number = 0;
  isLittleEndian?: boolean;
  isSigned?: boolean;
  addValue: number = 0;

  constructor(params: Partial<VolumeSettings> = {}) {
    Object.assign(this, params);
  }

  static fromJSON(json: string): VolumeSettings {
    return new VolumeSettings(JSON.parse(json));
  }

  toJSON(): string {
    return JSON.stringify({ ...this });
  }

  toFile(): File {
    if (!this.file) throw new Error("Missing 'file' parameter.");
    return new File(
      [this.toJSON()],
      Utils.removeExtensionFromPath(this.file) + ".json",
      { type: "application/json" }
    );
  }

  applyOverrides(overrides: Partial<VolumeSettings>) {
    Object.assign(this, overrides);
  }

  checkValidity(): void {
    if (!this.size) throw new Error("Missing 'size' parameter.");
    if (this.size.x < 1) throw new Error("'size.x' must be at least 1.");
    if (this.size.y < 1) throw new Error("'size.y' must be at least 1.");
    if (this.size.z < 1) throw new Error("'size.z' must be at least 1.");

    if (this.ratio.x <= 0) throw new Error("'ratio.x' must be greater than 0.");
    if (this.ratio.y <= 0) throw new Error("'ratio.y' must be greater than 0.");
    if (this.ratio.z <= 0) throw new Error("'ratio.z' must be greater than 0.");

    if (this.bytesPerVoxel === undefined)
      throw new Error("Missing 'bytesPerVoxel' parameter.");
    if (this.usedBits === undefined)
      throw new Error("Missing 'usedBits' parameter.");
    if (this.isSigned === undefined)
      throw new Error("Missing 'isSigned' parameter.");
    if (this.isLittleEndian === undefined)
      throw new Error("Missing 'isLittleEndian' parameter.");
  }
}
