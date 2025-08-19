import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import { Volume, VolumeInstance } from "../userState/VolumeModel";
import { Result, ResultInstance } from "../userState/ResultModel";
import { flow, isAlive } from "mobx-state-tree";
import * as Utils from "../../utils/Helpers";
import {
  SparseLabelVolume,
  SparseVolumeInstance,
} from "../userState/SparseVolumeModel";
import {
  PseudoLabelVolume,
  PseudoVolumeInstance,
} from "../userState/PseudoVolumeModel";
import { Id, toast } from "react-toastify";
import z from "zod";
import { getVolumeSchema } from "../../../../schemas/volume-path-schema.mjs";

export type visualizedObjectInstances =
  | VolumeInstance
  | SparseVolumeInstance
  | PseudoVolumeInstance
  | ResultInstance
  | undefined;

async function loadSparseLabelVolumesIntoAnnotations(
  volume: VolumeInstance,
  toastId: Id
) {
  if (!window.WasmModule) {
    throw new Error("WasmModule is not loaded.");
  }
  const sparseVolumeArray = volume.sparseVolumeArray;
  const volumeNames = new window.WasmModule.VectorString();
  for (let i = 0; i < sparseVolumeArray.length; i++) {
    const sparseVolume = sparseVolumeArray[i];
    toast.update(toastId, {
      render: `Fetching manual label volume ${i + 1}/${
        sparseVolumeArray.length
      }`,
      isLoading: true,
      autoClose: false,
    });
    await Utils.waitForNextFrame();

    const response = await Utils.sendReq(
      `volumeData/SparseLabeledVolumeData/${sparseVolume.id}/download-raw-file`,
      {
        method: "GET",
      },
      false
    );

    const contents = await response.blob();
    const fileMap = await Utils.zipToFileMap(contents);
    const rawFile = fileMap.values().next().value;
    if (!rawFile) {
      throw new Error("No annotation volume found.");
    }
    const rawFileContent = await rawFile.arrayBuffer();
    const data = new Uint8Array(rawFileContent);
    const fileName = `SparseLabeledVolumeData-${sparseVolume.id}`;
    window.WasmModule?.FS.writeFile(fileName, data);
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
    window.WasmModule?.set_annotation_color(i, r, g, b);
  }
  for (let i = sparseVolumeArray.length; i < 4; i++) {
    const color = Utils.fromHexColor(volume.sparseLabelColors[i]);
    volume.setShownAnnotation(i, false);
    window.WasmModule?.set_annotation_color(
      i,
      color.r / 255,
      color.g / 255,
      color.b / 255
    );
  }
  window.WasmModule?.load_volume_into_annotation(volumeNames);
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
      types.enumeration("ClippingPlane", ["0", "1", "2", "3", "4"]),
      "0"
    ),
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
    get canEditLabels() {
      return self.volume !== undefined;
    },
  }))
  .actions((self) => ({
    resetSaveAsNew() {
      for (let i = 0; i < self.saveAsNew.length; i++) {
        self.saveAsNew[i] = false;
      }
    },
    afterAttach() {
      if (!window.WasmModule) {
        return;
      }
      window.WasmModule?.chooseClippingPlane(parseInt(self.clippingPlane));
      window.WasmModule?.set_fullscreen_mode(self.fullscreen);
      window.WasmModule?.show_raw_data_on_clipping(self.showRawClippingPlane);
      window.WasmModule?.set_annotation_mode(!self.eraseMode);
      window.WasmModule?.enable_annotation_mode(false);
    },
    setFullscreen(enable: boolean) {
      if (!window.WasmModule) {
        return;
      }
      if (enable && self.clippingPlane === "0") {
        return;
      }
      self.fullscreen = enable;
      window.WasmModule?.set_fullscreen_mode(enable);
    },
    setShowRawClippingPlane(enable: boolean) {
      if (!window.WasmModule) {
        return;
      }
      if (enable && self.rawSettings === undefined) {
        return;
      }
      self.showRawClippingPlane = enable;
      window.WasmModule?.show_raw_data_on_clipping(enable);
    },
    setEraseMode(enable: boolean) {
      if (!window.WasmModule) {
        return;
      }
      if (!self.canEditLabels || !self.labelEditingMode) {
        return;
      }

      self.eraseMode = enable;
      window.WasmModule?.set_annotation_mode(!enable);
    },
  }))
  .actions((self) => ({
    setManualLabelIndex(index: number) {
      if (!window.WasmModule) {
        return;
      }
      self.manualLabelIndex = index;
      window.WasmModule?.set_annotation_channel(index);
      self.volume?.setShownAnnotation(index, true);
    },
    setClippingPlane(clippingPlane: "0" | "1" | "2" | "3" | "4") {
      if (!window.WasmModule) {
        return;
      }
      self.clippingPlane = clippingPlane;
      window.WasmModule?.chooseClippingPlane(parseInt(clippingPlane));
      if (self.fullscreen) {
        self.setFullscreen(false);
      }
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
      window.WasmModule?.clear_annotations(self.manualLabelIndex);
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
      let toastId = null;
      try {
        toastId = toast.loading("Fething volume data...");
        if (!window.WasmModule) {
          throw new Error("WasmModule is not loaded.");
        }
        if (self.volume === undefined) {
          throw new Error("Only raw volumes can be labeled.");
        }
        const response = yield Utils.sendReq(
          `/volume/${self.volume.id}?sparseVolumes=true`,
          {
            method: "GET",
          },
          false
        );
        if (!isAlive(self)) {
          return;
        }
        const volume: z.infer<typeof getVolumeSchema> = yield response.json();
        if (!isAlive(self)) {
          return;
        }
        self.volume.setSparseVolumes(volume.sparseVolumes);
        yield loadSparseLabelVolumesIntoAnnotations(self.volume, toastId);
        if (!isAlive(self)) {
          return;
        }

        self.labelEditingMode = enable;
        window.WasmModule?.enable_annotation_mode(true);
        self.setManualLabelIndex(0);

        if (self.clippingPlane === "0") {
          self.setClippingPlane("4");
        }

        toast.update(toastId, {
          render: "Labeling mode enabled.",
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });
      } catch (error) {
        Utils.updateToastWithErrorMsg(toastId, error);
        throw error;
      }
    }),
  }));

export interface VisualizedVolumeInstance
  extends Instance<typeof VisualizedVolume> {}
export interface VisualizedVolumeSnapshotIn
  extends SnapshotIn<typeof VisualizedVolume> {}
