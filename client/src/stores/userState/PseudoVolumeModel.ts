import { Instance, SnapshotIn, types } from "mobx-state-tree";

export const PseudoLabelVolume = types.model({
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
  volumeId: types.integer,
});

export interface PseudoVolumeInstance
  extends Instance<typeof PseudoLabelVolume> {}
export interface PseudoVolumeSnapshotIn
  extends SnapshotIn<typeof PseudoLabelVolume> {}
