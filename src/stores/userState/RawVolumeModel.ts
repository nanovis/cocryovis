import { Instance, SnapshotIn, types } from "mobx-state-tree";

export const RawVolume = types.model({
  id: types.identifierNumber,
  path: types.maybeNull(types.string),
  folderPath: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.integer),
  rawFilePath: types.maybeNull(types.string),
  settings: types.maybeNull(types.string),
  mrcFilePath: types.maybeNull(types.string),
});

export interface RawVolumeInstance extends Instance<typeof RawVolume> {}
export interface RawVolumeSnapshotIn extends SnapshotIn<typeof RawVolume> {}
