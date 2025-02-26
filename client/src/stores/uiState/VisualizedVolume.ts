import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import { VolumeInstance } from "../userState/VolumeModel";
import { ResultInstance } from "../userState/ResultModel";

export type visualizedObjectInstances =
  | VolumeInstance
  | ResultInstance
  | undefined;

export const VisualizedVolume = types
  .model({
    visualizedObjectType: types.maybe(
      types.enumeration("VisualizedObjectType", ["Volume", "Result"])
    ),
    visualizedObjectId: types.maybe(types.integer),
    volVisSettings: types.array(VolVisSettings),
    clippingPlane: types.optional(
      types.enumeration("ClippingPlane", ["0", "1", "2", "3", "4"]),
      "0"
    ),
  })
  .views((self) => ({
    get rawSettings() {
      return self.volVisSettings.find(
        (volVisSettings) => volVisSettings.type === "raw"
      );
    },
    get shadowsSettings() {
      return self.volVisSettings.find(
        (volVisSettings) => volVisSettings.type === "shadows"
      );
    },
    get volumeSettings() {
      return self.volVisSettings.filter(
        (volVisSettings) => volVisSettings.type === "volume"
      );
    },
  }))
  .actions((self) => ({
    clearVisualization() {
      // self.visualizedObject = undefined;
      self.volVisSettings.clear();
    },
    setClippingPlane(clippingPlane: "0" | "1" | "2" | "3" | "4") {
      self.clippingPlane = clippingPlane;
      window.WasmModule?.chooseClippingPlane(clippingPlane);
    },
  }));

// VisualizedVolume.actions((self) => ({
//   setVisualizedObject(
//     visualizedObjectType: VisualizedVolumeInstance["visualizedObject"],
//     volumeSettingsInstances: VolVisSettingsSnapshotIn[]
//   ) {
//     // self.visualizedObject = visualizedObject;

//     self.volVisSettings.clear();
//     volumeSettingsInstances.forEach((volumeSettingsInstance) => {
//       self.volVisSettings.push(volumeSettingsInstance);
//     });
//   },
// }));

export interface VisualizedVolumeInstance
  extends Instance<typeof VisualizedVolume> {}
export interface VisualizedVolumeSnapshotIn
  extends SnapshotIn<typeof VisualizedVolume> {}
