import type { Instance, SnapshotIn } from "mobx-state-tree";
import { types } from "mobx-state-tree";
import { TransferFunction } from "./TransferFunction";

export const VolVisSettings = types
  .model({
    index: types.identifierNumber,
    name: types.string,
    transferFunction: TransferFunction,
    visible: types.optional(types.boolean, true),
    clipping: types.optional(types.boolean, true),
    type: types.enumeration("VolumeType", ["volume", "raw", "shadows"]),
  })
  .actions((self) => ({
    setVisibility(visible: boolean) {
      self.visible = visible;
      window.WasmModule?.show_volume(self.index, visible);
    },
    setClipping(clipping: boolean) {
      self.clipping = clipping;
      window.WasmModule?.clip_volume(clipping, self.index);
    },
  }));

export interface VolVisSettingsInstance extends Instance<
  typeof VolVisSettings
> {}
export interface VolVisSettingsSnapshotIn extends SnapshotIn<
  typeof VolVisSettings
> {}
