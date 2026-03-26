import type { Instance, SnapshotIn } from "mobx-state-tree";
import { types } from "mobx-state-tree";

export const RawVolume = types
  .model({
    id: types.identifierNumber,
    creatorId: types.maybeNull(types.integer),
    name: types.string,
    sizeX: types.integer,
    sizeY: types.integer,
    sizeZ: types.integer,
    skipBytes: types.integer,
    isLittleEndian: types.boolean,
    isSigned: types.boolean,
    addValue: types.integer,
    bytesPerVoxel: types.integer,
    usedBits: types.integer,
    reconstructionParameters: types.maybeNull(types.frozen()),
    volumeId: types.maybeNull(types.integer),
  })
  .views((self) => ({
    get reconstructionParametersString(): string | undefined {
      if (!self.reconstructionParameters) {
        return undefined;
      }

      try {
        return JSON.stringify(self.reconstructionParameters, null, 2);
      } catch {
        return String(self.reconstructionParameters);
      }
    },
  }));

export interface RawVolumeInstance extends Instance<typeof RawVolume> {}
export interface RawVolumeSnapshotIn extends SnapshotIn<typeof RawVolume> {}
