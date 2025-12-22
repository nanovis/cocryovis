import type { Instance, SnapshotIn } from "mobx-state-tree";
import { types } from "mobx-state-tree";

export const RawVolume = types.model({
  id: types.identifierNumber,
  creatorId: types.maybeNull(types.integer),
  name: types.string,
  sizeX: types.integer,
  sizeY: types.integer,
  sizeZ: types.integer,
  ratioX: types.number,
  ratioY: types.number,
  ratioZ: types.number,
  skipBytes: types.integer,
  isLittleEndian: types.boolean,
  isSigned: types.boolean,
  addValue: types.integer,
  bytesPerVoxel: types.integer,
  usedBits: types.integer,
  volumeId: types.maybeNull(types.integer),
});

export interface RawVolumeInstance extends Instance<typeof RawVolume> {}
export interface RawVolumeSnapshotIn extends SnapshotIn<typeof RawVolume> {}
