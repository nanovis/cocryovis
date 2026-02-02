import {
  getParentOfType,
  type Instance,
  type SnapshotIn,
} from "mobx-state-tree";
import { types } from "mobx-state-tree";
import { TransferFunction } from "./TransferFunction";
import { RootStore } from "../RootStore";
import type { VolumeRenderer } from "@/renderer/renderer";

export const VolVisSettings = types
  .model({
    index: types.identifierNumber,
    name: types.string,
    transferFunction: TransferFunction,
    visible: types.optional(types.boolean, true),
    // clipping: types.optional(types.boolean, true),
    type: types.enumeration("VolumeType", ["volume", "raw"]),
  })
  .views((self) => ({
    get renderer(): VolumeRenderer | null {
      const rootStore = getParentOfType<typeof RootStore>(self, RootStore);
      return rootStore.renderer;
    },
  }))
  .actions((self) => ({
    setVisibility(visible: boolean) {
      self.visible = visible;
      self.renderer?.volumeManager.channelData.set(self.index, {
        visible: visible,
      });
    },
    // setClipping(clipping: boolean) {
    //   self.clipping = clipping;
    //   window.WasmModule?.clip_volume(clipping, self.index);
    // },
  }));

export interface VolVisSettingsInstance extends Instance<
  typeof VolVisSettings
> {}
export interface VolVisSettingsSnapshotIn extends SnapshotIn<
  typeof VolVisSettings
> {}
