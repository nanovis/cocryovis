import * as Utils from "./Helpers";

export interface Vector3 { x: number; y: number; z: number }

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

  static readonly bitOptions = [8, 16, 32, 64];
  static readonly bytesPerVoxelOptions = [1, 2, 4, 8];

  constructor(params: Partial<VolumeSettings> = {}) {
    Object.assign(this, params);
  }

  static fromJSON(json: string): VolumeSettings {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return new VolumeSettings(JSON.parse(json));
  }

  toJSON(): string {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
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
    if (!this.file) throw new Error("Missing 'file' parameter.");

    if (!this.size) throw new Error("Missing 'size' parameter.");

    if (isNaN(this.size.x)) throw new Error("'size.x' must be a number.");
    if (isNaN(this.size.y)) throw new Error("'size.y' must be a number.");
    if (isNaN(this.size.z)) throw new Error("'size.z' must be a number.");
    if (this.size.x < 1) throw new Error("'size.x' must be at least 1.");
    if (this.size.y < 1) throw new Error("'size.y' must be at least 1.");
    if (this.size.z < 1) throw new Error("'size.z' must be at least 1.");

    if (isNaN(this.ratio.x)) throw new Error("'ratio.x' must be a number.");
    if (isNaN(this.ratio.y)) throw new Error("'ratio.y' must be a number.");
    if (isNaN(this.ratio.z)) throw new Error("'ratio.z' must be a number.");
    if (this.ratio.x <= 0) throw new Error("'ratio.x' must be greater than 0.");
    if (this.ratio.y <= 0) throw new Error("'ratio.y' must be greater than 0.");
    if (this.ratio.z <= 0) throw new Error("'ratio.z' must be greater than 0.");

    if (this.bytesPerVoxel === undefined)
      throw new Error("Missing 'bytesPerVoxel' parameter.");
    if (isNaN(this.bytesPerVoxel))
      throw new Error("'bytesPerVoxel' must be a number.");
    if (!VolumeSettings.bytesPerVoxelOptions.includes(this.bytesPerVoxel))
      throw new Error(
        `'bytesPerVoxel' must be one of 
        ${VolumeSettings.bytesPerVoxelOptions.join(", ")}.`
      );

    if (this.usedBits === undefined)
      throw new Error("Missing 'usedBits' parameter.");
    if (isNaN(this.usedBits)) throw new Error("'usedBits' must be a number.");
    if (!VolumeSettings.bitOptions.includes(this.usedBits))
      throw new Error(
        `'usedBits' must be one of ${VolumeSettings.bitOptions.join(", ")}.`
      );

    if (this.isSigned === undefined)
      throw new Error("Missing 'isSigned' parameter.");
    if (this.isLittleEndian === undefined)
      throw new Error("Missing 'isLittleEndian' parameter.");
  }
}
