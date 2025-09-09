import { Instance, SnapshotIn, types } from "mobx-state-tree";

export const RawVolume = types.model({
  id: types.identifierNumber,
  path: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.integer),
  rawFilePath: types.maybeNull(types.string),
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
  mrcFilePath: types.maybeNull(types.string),
});

export interface RawVolumeInstance extends Instance<typeof RawVolume> {}
export interface RawVolumeSnapshotIn extends SnapshotIn<typeof RawVolume> {}
