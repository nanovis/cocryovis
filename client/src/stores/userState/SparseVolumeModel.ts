import { Instance, SnapshotIn, types } from "mobx-state-tree";

export const SparseLabelVolume = types.model({
  id: types.identifierNumber,
  path: types.maybeNull(types.string),
  folderPath: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.integer),
  rawFilePath: types.maybeNull(types.string),
  settings: types.maybeNull(types.string),
});

export interface SparseVolumeInstance
  extends Instance<typeof SparseLabelVolume> {}
export interface SparseVolumeSnapshotIn
  extends SnapshotIn<typeof SparseLabelVolume> {}
