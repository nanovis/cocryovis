import {
  getParentOfType,
  type Instance,
  type SnapshotIn,
} from "mobx-state-tree";
import { types } from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import type { VolumeInstance } from "../userState/VolumeModel";
import { Volume } from "../userState/VolumeModel";
import type { ResultInstance } from "../userState/ResultModel";
import { Result } from "../userState/ResultModel";
import { flow, isAlive } from "mobx-state-tree";
import * as Utils from "../../utils/Helpers";
import type { SparseVolumeInstance } from "../userState/SparseVolumeModel";
import { SparseLabelVolume } from "../userState/SparseVolumeModel";
import type { PseudoVolumeInstance } from "../userState/PseudoVolumeModel";
import { PseudoLabelVolume } from "../userState/PseudoVolumeModel";
import type z from "zod";
import type { getVolumeSchema } from "#schemas/volume-path-schema.mjs";
import { downloadRawFile } from "../../api/volumeData";
import { getVolumeWithSparseVolumes } from "../../api/volume";
import ToastContainer from "../../utils/ToastContainer";
import type { VolumeRenderer } from "../../renderer/renderer.ts";
import { RootStore } from "../RootStore.ts";
import { clamp } from "../../utils/Helpers";
import type { ClippingPlaneType } from "../../renderer/clippingPlaneManager.ts";
import type { OrbitCameraController } from "../../utils/orbitCameraController.ts";

export type visualizedObjectInstances =
  | VolumeInstance
  | SparseVolumeInstance
  | PseudoVolumeInstance
  | ResultInstance
  | undefined;

async function loadSparseLabelVolumesIntoAnnotations(
  volume: VolumeInstance,
  toastContainer: ToastContainer
) {
  if (!window.WasmModule) {
    throw new Error("WasmModule is not loaded.");
  }
  const sparseVolumeArray = volume.sparseVolumeArray;
  const volumeNames = new window.WasmModule.VectorString();
  for (let i = 0; i < sparseVolumeArray.length; i++) {
    const sparseVolume = sparseVolumeArray[i];
    toastContainer.loading(
      `Fetching manual label volume ${i + 1}/${sparseVolumeArray.length}`
    );

    await Utils.waitForNextFrame();

    const contents = await downloadRawFile(sparseVolume.id);
    const fileMap = await Utils.zipToFileMap(contents);
    const rawFile = fileMap.values().next().value;
    if (!rawFile) {
      throw new Error("No annotation volume found.");
    }
    const rawFileContent = await rawFile.arrayBuffer();
    const data = new Uint8Array(rawFileContent);
    const fileName = `SparseLabeledVolumeData-${sparseVolume.id}`;
    window.WasmModule.FS.writeFile(fileName, data);
    volumeNames.push_back(fileName);

    let r = 1;
    let g = 1;
    let b = 1;

    if (sparseVolume.color !== null) {
      const color = Utils.fromHexColor(sparseVolume.color);
      r = color.r / 255;
      g = color.g / 255;
      b = color.b / 255;
    }
    volume.setShownAnnotation(i, true);
    window.WasmModule.set_annotation_color(i, r, g, b);
  }
  for (let i = sparseVolumeArray.length; i < 4; i++) {
    const color = Utils.fromHexColor(volume.sparseLabelColors[i]);
    volume.setShownAnnotation(i, false);
    window.WasmModule.set_annotation_color(
      i,
      color.r / 255,
      color.g / 255,
      color.b / 255
    );
  }
  window.WasmModule.load_volume_into_annotation(volumeNames);
}

export const VisualizedVolume = types
  .model({
    volume: types.maybe(types.reference(Volume)),
    sparseLabelVolume: types.maybe(types.reference(SparseLabelVolume)),
    sparseLabelVolumes: types.maybe(
      types.array(types.reference(SparseLabelVolume))
    ),
    pseudoLabelVolume: types.maybe(types.reference(PseudoLabelVolume)),
    PseudoLabelVolumes: types.maybe(
      types.array(types.reference(PseudoLabelVolume))
    ),
    result: types.maybe(types.reference(Result)),
    volVisSettings: types.array(VolVisSettings),
    clippingPlane: types.optional(
      types.enumeration("ClippingPlane", [
        "view-aligned",
        "x",
        "y",
        "z",
        "none",
      ]),
      "none"
    ),
    clippingPlaneOffset: types.optional(types.number, 0),
    labelEditingMode: types.optional(types.boolean, false),
    manualLabelIndex: types.optional(types.integer, 0),
    fullscreen: types.optional(types.boolean, false),
    showRawClippingPlane: types.optional(types.boolean, false),
    eraseMode: types.optional(types.boolean, false),
    saveAsNew: types.optional(types.array(types.boolean), Array(4).fill(false)),
  })
  .views((self) => ({
    get rawSettings() {
      return self.volVisSettings.find(
        (volVisSettings) => volVisSettings.type === "raw"
      );
    },
    get volumeSettings() {
      return self.volVisSettings.filter(
        (volVisSettings) => volVisSettings.type === "volume"
      );
    },
    get canEditLabels() {
      return self.volume !== undefined;
    },
    get renderer(): VolumeRenderer | null {
      const rootStore = getParentOfType<typeof RootStore>(self, RootStore);
      return rootStore.renderer;
    },
    get orbitCameraController(): OrbitCameraController | null {
      const rootStore = getParentOfType<typeof RootStore>(self, RootStore);
      return rootStore.orbitCameraController;
    },
  }))
  .actions((self) => ({
    resetSaveAsNew() {
      for (let i = 0; i < self.saveAsNew.length; i++) {
        self.saveAsNew[i] = false;
      }
    },
    setFullscreen(enable: boolean) {
      if (enable === self.fullscreen) {
        return;
      }
      if (enable && self.clippingPlane === "none") {
        return;
      }
      self.fullscreen = enable;
      self.orbitCameraController?.setActive(!enable);
      self.renderer?.clippingPlaneManager.setFullscreen(enable);
    },
    setShowRawClippingPlane(enable: boolean) {
      if (enable && self.rawSettings === undefined) {
        return;
      }
      self.showRawClippingPlane = enable;
      self.renderer?.volumeManager.volumeParameterBuffer.set({
        rawClippingPlane: enable,
      });
    },
    setEraseMode(enable: boolean) {
      if (!window.WasmModule) {
        return;
      }
      if (!self.canEditLabels || !self.labelEditingMode) {
        return;
      }

      self.eraseMode = enable;
      window.WasmModule.set_annotation_mode(!enable);
    },
    setClippingOffset(offset: number) {
      if (self.clippingPlane === "none") {
        return;
      }
      self.clippingPlaneOffset = clamp(offset, -1, 1);
      self.renderer?.clippingPlaneManager.setClippingPlaneOffset(offset);
    },
  }))
  .actions((self) => ({
    setManualLabelIndex(index: number) {
      if (!window.WasmModule) {
        return;
      }
      self.manualLabelIndex = index;
      window.WasmModule.set_annotation_channel(index);
      self.volume?.setShownAnnotation(index, true);
    },
    setClippingPlane(clippingPlane: ClippingPlaneType) {
      self.clippingPlane = clippingPlane;
      self.renderer?.clippingPlaneManager.setClippingPlane(clippingPlane);
      if (self.fullscreen && clippingPlane === "none") {
        self.setFullscreen(false);
      }
    },
    changeClippingPlaneOffset(offset: number) {
      self.setClippingOffset(self.clippingPlaneOffset + offset);
    },
    clearActiveAnnotationChannel() {
      if (
        !window.WasmModule ||
        self.manualLabelIndex > 4 ||
        self.manualLabelIndex < 0
      ) {
        return;
      }
      self.saveAsNew[self.manualLabelIndex] = true;
      window.WasmModule.clear_annotations(self.manualLabelIndex);
    },
  }))
  .actions((self) => ({
    setLabelEditingMode: flow(function* setLabelEditingMode(enable: boolean) {
      self.resetSaveAsNew();
      if (!enable) {
        self.labelEditingMode = false;
        window.WasmModule?.enable_annotation_mode(false);
        window.WasmModule?.clear_annotations(-1);
        return;
      }
      const toastContainer = new ToastContainer();
      try {
        toastContainer.loading("Fetching volume data...");
        if (!window.WasmModule) {
          throw new Error("WasmModule is not loaded.");
        }
        if (self.volume === undefined) {
          throw new Error("Only raw volumes can be labeled.");
        }

        const volume: z.infer<typeof getVolumeSchema> =
          yield getVolumeWithSparseVolumes(self.volume.id);
        if (!isAlive(self)) {
          return;
        }
        self.volume.setSparseVolumes(volume.sparseVolumes);
        yield loadSparseLabelVolumesIntoAnnotations(
          self.volume,
          toastContainer
        );
        if (!isAlive(self)) {
          return;
        }

        self.labelEditingMode = enable;
        window.WasmModule.enable_annotation_mode(true);
        self.setManualLabelIndex(0);

        if (self.clippingPlane === "none") {
          self.setClippingPlane("z");
        }
        toastContainer.success("Labeling mode enabled.");
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
        throw error;
      }
    }),
  }));

export interface VisualizedVolumeInstance extends Instance<
  typeof VisualizedVolume
> {}
export interface VisualizedVolumeSnapshotIn extends SnapshotIn<
  typeof VisualizedVolume
> {}
