import { Instance, SnapshotIn, types } from "mobx-state-tree";

export const PseudoLabelVolume = types.model({
  id: types.identifierNumber,
  path: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.integer),
  rawFilePath: types.maybeNull(types.string),
  settings: types.maybeNull(types.string),
});

export interface PseudoVolumeInstance
  extends Instance<typeof PseudoLabelVolume> {}
export interface PseudoVolumeSnapshotIn
  extends SnapshotIn<typeof PseudoLabelVolume> {}
