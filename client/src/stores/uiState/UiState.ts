import {
  flow,
  getType,
  Instance,
  isAlive,
  SnapshotIn,
  types,
} from "mobx-state-tree";
import {
  visualizedObjectInstances,
  VisualizedVolume,
  VisualizedVolumeSnapshotIn,
} from "./VisualizedVolume";
import { VolVisSettingsSnapshotIn } from "./VolVisSettings";
import * as Utils from "../../utils/Helpers";
import { Volume } from "../userState/VolumeModel";
import { CONFIG } from "../../Constants.mjs";
import { RenderSettings } from "./RenderSettings";
import { UploadDialog } from "./UploadDialog";
import { Result } from "../userState/ResultModel";
import { SparseLabelVolume } from "../userState/SparseVolumeModel";
import { PseudoLabelVolume } from "../userState/PseudoVolumeModel";
import { TiltSeriesDialog } from "./TiltSeriesDialog";

export const UiState = types
  .model({
    openLeftWidget: types.optional(types.number, -1),
    openRightWidget: types.optional(types.number, -1),
    openProfilePage: types.optional(types.boolean, false),
    openAdminPanel: types.optional(types.boolean, false),
    kernelSize: types.optional(types.integer, 25),
    visualizedVolume: types.maybe(VisualizedVolume),
    renderSettings: types.optional(RenderSettings, {}),
    uploadDialog: types.optional(UploadDialog, {}),
    tiltSeriesDialogServer: types.optional(TiltSeriesDialog, {}),
    tiltSeriesDialogClient: types.optional(TiltSeriesDialog, {}),
  })
  .actions((self) => ({
    setOpenLeftWidget(id: number) {
      self.openLeftWidget = self.openLeftWidget !== id ? id : -1;
    },
    closeLeftHandWidgets() {
      self.openLeftWidget = -1;
    },
    setOpenRightWidget(id: number) {
      self.openRightWidget = self.openRightWidget !== id ? id : -1;
    },
    closeRightHandWidgets() {
      self.openRightWidget = -1;
    },
    setOpenProfilePage(open: boolean) {
      self.openProfilePage = open;
      if (self.openProfilePage) {
        self.openAdminPanel = false;
      }
    },
    toggleOpenProfilePage() {
      self.openProfilePage = !self.openProfilePage;
      if (self.openProfilePage) {
        self.openAdminPanel = false;
      }
    },
    setOpenAdminPage(open: boolean) {
      self.openAdminPanel = open;
      if (self.openAdminPanel) {
        self.openProfilePage = false;
      }
    },
    toggleOpenAdminPage() {
      self.openAdminPanel = !self.openAdminPanel;
      if (self.openAdminPanel) {
        self.openProfilePage = false;
      }
    },
    setKernelSize(kernalSize: number) {
      self.kernelSize = kernalSize;
      window.WasmModule?.setAnnotationKernelSize(kernalSize);
    },
    setVizualizedVolume(properties: VisualizedVolumeSnapshotIn) {
      self.visualizedVolume = VisualizedVolume.create(properties);
    },
  }))
  .actions((self) => ({
    visualizeVolume: flow(function* visualizeVolume(
      filesMap: Map<string, Blob>,
      visualizedObject: visualizedObjectInstances
    ) {
      if (!window.WasmModule) {
        throw new Error("Wasm module not initialized!");
      }

      const configBlob = filesMap.get("config.json");
      let config = null;
      if (!configBlob) {
        console.warn(
          "Missing config.json file. It will be generated automatically."
        );
        const JSONfiles = Array.from(filesMap.keys()).filter((key) =>
          key.endsWith(".json")
        );
        if (JSONfiles.length === 0) {
          throw new Error("No JSON files found.");
        }
        if (JSONfiles.length > 1) {
          throw new Error(
            "Too many JSON files found. Attach a cofing.json file with a file array pointing to volume setting files."
          );
        }
        config = {
          files: [JSONfiles[0]],
        };
      } else {
        const configData = yield configBlob.text();
        if (!isAlive(self)) {
          return;
        }
        config = JSON.parse(configData);
      }

      window.WasmModule?.FS.writeFile("config.json", JSON.stringify(config));

      const volumeVisualizationSettings: Array<VolVisSettingsSnapshotIn> = [];

      const vizualizedVolume: VisualizedVolumeSnapshotIn = {
        volVisSettings: volumeVisualizationSettings,
      };

      if (visualizedObject !== undefined) {
        if (getType(visualizedObject) === Volume) {
          vizualizedVolume.volume = visualizedObject.id;
        } else if (getType(visualizedObject) === Result) {
          vizualizedVolume.result = visualizedObject.id;
        } else if (getType(visualizedObject) === SparseLabelVolume) {
          vizualizedVolume.sparseLabelVolume = visualizedObject.id;
        } else if (getType(visualizedObject) === PseudoLabelVolume) {
          vizualizedVolume.pseudoLabelVolume = visualizedObject.id;
        }
      }

      const transferFunctionDefinitions = new Map();
      let defaultTFIndex = 0;

      for (const [index, fileName] of config.files.entries()) {
        const file = filesMap.get(fileName);

        if (!file) {
          throw new Error(`Missing setting file: ${fileName}`);
        }

        const fileContent = yield file.text();
        if (!isAlive(self)) {
          return;
        }
        const settings = JSON.parse(fileContent);

        const rawFile = filesMap.get(settings.file);

        if (!rawFile) {
          throw new Error(`Missing raw file: ${settings.file}`);
        }

        const rawFileContent = yield rawFile.arrayBuffer();
        if (!isAlive(self)) {
          return;
        }
        const data = new Uint8Array(rawFileContent);
        window.WasmModule?.FS.writeFile(settings.file, data);

        let transferFunction = null;

        if (settings.transferFunction) {
          transferFunction = transferFunctionDefinitions.get(
            settings.transferFunction
          );
          if (!transferFunction) {
            const transferFunctionFile = filesMap.get(
              "transfer-functions/" + settings.transferFunction
            );
            if (!transferFunctionFile) {
              console.warn(
                `Missing transfer function file: ${settings.transferFunction}`
              );
            } else {
              const transferFunctionContent = yield transferFunctionFile.text();
              if (!isAlive(self)) {
                return;
              }
              window.WasmModule?.FS.writeFile(
                settings.transferFunction,
                transferFunctionContent
              );

              transferFunction = JSON.parse(transferFunctionContent);

              transferFunctionDefinitions.set(
                settings.transferFunction,
                transferFunction
              );
            }
          }
        }

        if (!transferFunction) {
          const blankTF =
            (!visualizedObject && config.files.length === 1) ||
            (visualizedObject && getType(visualizedObject) === Volume);
          const { tfName, tfDefinition } = Utils.pickDefaultTF(
            defaultTFIndex,
            blankTF
          );
          defaultTFIndex++;

          transferFunction = transferFunctionDefinitions.get(tfName);
          settings.transferFunction = tfName;
          if (!transferFunction) {
            transferFunction = tfDefinition;
            transferFunctionDefinitions.set(tfName, transferFunction);
            window.WasmModule?.FS.writeFile(
              tfName,
              JSON.stringify(transferFunction)
            );
          }
        }

        window.WasmModule?.FS.writeFile(fileName, JSON.stringify(settings));

        if (
          index === config.rawVolumeChannel ||
          index === CONFIG.shadowsTransferFunctionIndex ||
          index < CONFIG.visibleVolumes
        ) {
          volumeVisualizationSettings.push({
            index: index,
            name: settings.name ?? `Volume ${index}`,
            type:
              index === config.rawVolumeChannel
                ? "raw"
                : index === CONFIG.shadowsTransferFunctionIndex
                  ? "shadows"
                  : "volume",
            transferFunction: {
              rampLow: transferFunction.rampLow,
              rampHigh: transferFunction.rampHigh,
              red: transferFunction.color.x,
              green: transferFunction.color.y,
              blue: transferFunction.color.z,
              comment: transferFunction.comment ?? `transferFunction_${index}`,
            },
          });
        }
      }

      self.setVizualizedVolume(vizualizedVolume);

      console.log("File reading done.");
      window.WasmModule?.open_volume();
    }),
  }));

export interface UiStateInstance extends Instance<typeof UiState> {}
export interface UiStateSnapshotIn extends SnapshotIn<typeof UiState> {}
