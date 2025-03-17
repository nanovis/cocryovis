import { getType, Instance, SnapshotIn, types } from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import { Volume, VolumeInstance } from "../userState/VolumeModel";
import { Result, ResultInstance } from "../userState/ResultModel";
import { flow, isAlive } from "mobx-state-tree";
import Utils from "../../functions/Utils";
import { SparseLabelVolume } from "../userState/SparseVolumeModel";
import { PseudoLabelVolume } from "../userState/PseudoVolumeModel";
import { Id, toast } from "react-toastify";

export type visualizedObjectInstances =
  | VolumeInstance
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
    const sparseLabelVolumeId = sparseVolumeArray[i].id;
    toast.update(toastId, {
      render: `Fetching manual label volume ${i + 1}/${
        sparseVolumeArray.length
      }`,
      isLoading: true,
      autoClose: false,
    });
    await Utils.waitForNextFrame();

    const response = await Utils.sendReq(
      `volumeData/SparseLabeledVolumeData/${sparseLabelVolumeId}/download-raw-file`,
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
    const fileName = `SparseLabeledVolumeData-${sparseLabelVolumeId}`;
    window.WasmModule?.FS.writeFile(fileName, data);
    volumeNames.push_back(fileName);
  }
  window.WasmModule?.load_volume_into_annotation(volumeNames);
}

export const VisualizedVolume = types
  .model({
    visualizedObject: types.maybe(
      types.union(
        types.reference(Volume),
        types.reference(SparseLabelVolume),
        types.reference(PseudoLabelVolume),
        types.reference(Result)
      )
    ),
    volVisSettings: types.array(VolVisSettings),
    clippingPlane: types.optional(
      types.enumeration("ClippingPlane", ["0", "1", "2", "3", "4"]),
      "0"
    ),
    labelEditingMode: types.optional(types.boolean, false),
    manualLabelIndex: types.maybe(types.integer),
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
    canEditLabels() {
      return (
        self.visualizedObject !== undefined &&
        getType(self.visualizedObject) === Volume
      );
    },
  }))
  .actions((self) => ({
    setManualLabelIndex(index: number) {
      self.manualLabelIndex = index;
      window.WasmModule?.set_annotation_channel(index);
    },
    clearVisualization() {
      // self.visualizedObject = undefined;
      self.volVisSettings.clear();
    },
    setClippingPlane(clippingPlane: "0" | "1" | "2" | "3" | "4") {
      self.clippingPlane = clippingPlane;
      window.WasmModule?.chooseClippingPlane(parseInt(clippingPlane));
    },
  }))
  .actions((self) => ({
    setLabelEditingMode: flow(function* setLabelEditingMode(enable: boolean) {
      if (!enable) {
        self.labelEditingMode = false;
        self.setClippingPlane("0");
        window.WasmModule?.enable_annotation_mode(false);
        window.WasmModule?.reset_annotations();
        return;
      }
      let toastId = null;
      try {
        toastId = toast.loading("Fething volume data...");
        if (!self.visualizedObject) {
          throw new Error("No visualized object found.");
        }
        if (getType(self.visualizedObject) !== Volume) {
          throw new Error("Only raw volumes can be labeled.");
        }
        const response = yield Utils.sendReq(
          `/volume/${self.visualizedObject?.id}?sparseVolumes=true`,
          {
            method: "GET",
          },
          false
        );
        if (!isAlive(self)) {
          return;
        }
        const volume = yield response.json();
        if (!isAlive(self)) {
          return;
        }
        const refVolume = self.visualizedObject as VolumeInstance;
        refVolume.setSparseVolumes(volume.sparseVolumes);
        // for (let i = 0; i < volume.sparseVolumes.length; i++) {
        //   toast.update(toastId, {
        //     render: `Fetching manual label volume ${i}/${volume.sparseVolumes.length}`,
        //     isLoading: true,
        //     autoClose: false,
        //   });
        //   yield Utils.waitForNextFrame();
        //   if (!isAlive(self)) {
        //     return;
        //   }
        //   yield loadSparseLabelVolumeIntoAnnotation(
        //     volume.sparseVolumes[i].id,
        //     i
        //   );
        //   if (!isAlive(self)) {
        //     return;
        //   }
        // }
        yield loadSparseLabelVolumesIntoAnnotations(refVolume, toastId);
        if (!isAlive(self)) {
          return;
        }

        self.labelEditingMode = enable;
        // window.WasmModule?.enable_annotation_mode(enable);
        if (volume.sparseVolumes.length > 0) {
          self.setManualLabelIndex(0);
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
