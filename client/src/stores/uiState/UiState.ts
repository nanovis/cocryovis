import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, getType, isAlive, types } from "mobx-state-tree";
import type {
  visualizedObjectInstances,
  VisualizedVolumeSnapshotIn,
} from "./VisualizedVolume";
import { VisualizedVolume } from "./VisualizedVolume";
import type { VolVisSettingsSnapshotIn } from "./VolVisSettings";
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
    openSignInPage: types.optional(types.boolean, false),
    openSignUpPage: types.optional(types.boolean, false),
    openProfilePage: types.optional(types.boolean, false),
    openAdminPanel: types.optional(types.boolean, false),
    kernelSize: types.optional(types.integer, 25),
    visualizedVolume: types.maybe(VisualizedVolume),
    renderSettings: types.optional(RenderSettings, {}),
    uploadDialog: types.optional(UploadDialog, {}),
    tiltSeriesDialogServer: types.optional(TiltSeriesDialog, {}),
    tiltSeriesDialogClient: types.optional(TiltSeriesDialog, {}),
  })
  .volatile(() => ({
    isSignInOrSignUpInProgress: false,
  }))
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
    setIsActive(active: boolean) {
      self.isSignInOrSignUpInProgress = active;
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
    toggleSignInPage() {
      self.openSignInPage = !self.openSignInPage;
      if (self.openSignInPage) {
        self.openSignUpPage = false;
      }
    },
    setOpenSignInPage(open: boolean) {
      self.openSignInPage = open;
      if (self.openSignInPage) {
        self.openSignUpPage = false;
      }
    },
    toggleSignUpPage() {
      self.openSignUpPage = !self.openSignUpPage;
      if (self.openSignUpPage) {
        self.openSignInPage = false;
      }
    },
    setOpenSignUpPage(open: boolean) {
      self.openSignUpPage = open;
      if (self.openSignUpPage) {
        self.openSignInPage = false;
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
        const configData: string = yield configBlob.text();
        if (!isAlive(self)) {
          return;
        }
        config = JSON.parse(configData);
      }

      window.WasmModule.FS.writeFile("config.json", JSON.stringify(config));

      const volumeVisualizationSettings: VolVisSettingsSnapshotIn[] = [];

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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      for (const [index, fileName] of config.files.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const file = filesMap.get(fileName);

        if (!file) {
          throw new Error(`Missing setting file: ${fileName}`);
        }

        const fileContent: string = yield file.text();
        if (!isAlive(self)) {
          return;
        }
        const settings = JSON.parse(fileContent);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
        const rawFile = filesMap.get(settings.file);

        if (!rawFile) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          throw new Error(`Missing raw file: ${settings.file}`);
        }

        const rawFileContent = yield rawFile.arrayBuffer();
        if (!isAlive(self)) {
          return;
        }
        const data = new Uint8Array(rawFileContent);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        window.WasmModule.FS.writeFile(settings.file, data);

        let transferFunction = null;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (settings.transferFunction) {
          transferFunction = transferFunctionDefinitions.get(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            settings.transferFunction
          );
          if (!transferFunction) {
            const transferFunctionFile = filesMap.get(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-plus-operands
              "transfer-functions/" + settings.transferFunction
            );
            if (!transferFunctionFile) {
              console.warn(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                `Missing transfer function file: ${settings.transferFunction}`
              );
            } else {
              const transferFunctionContent = yield transferFunctionFile.text();
              if (!isAlive(self)) {
                return;
              }
              window.WasmModule.FS.writeFile(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                settings.transferFunction,
                transferFunctionContent
              );

              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              transferFunction = JSON.parse(transferFunctionContent);

              transferFunctionDefinitions.set(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                settings.transferFunction,
                transferFunction
              );
            }
          }
        }

        if (!transferFunction) {
          const blankTF =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (!visualizedObject && config.files.length === 1) ||
            (visualizedObject && getType(visualizedObject) === Volume);
          const { tfName, tfDefinition } = Utils.pickDefaultTF(
            defaultTFIndex,
            blankTF
          );
          defaultTFIndex++;

          transferFunction = transferFunctionDefinitions.get(tfName);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          settings.transferFunction = tfName;
          if (!transferFunction) {
            transferFunction = tfDefinition;
            transferFunctionDefinitions.set(tfName, transferFunction);
            window.WasmModule.FS.writeFile(
              tfName,
              JSON.stringify(transferFunction)
            );
          }
        }

        window.WasmModule.FS.writeFile(fileName, JSON.stringify(settings));

        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          index === config.rawVolumeChannel ||
          index === CONFIG.shadowsTransferFunctionIndex ||
          index < CONFIG.visibleVolumes
        ) {
          volumeVisualizationSettings.push({
            index: index,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            name: settings.name ?? `Volume ${index}`,
            type:
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              index === config.rawVolumeChannel
                ? "raw"
                : index === CONFIG.shadowsTransferFunctionIndex
                  ? "shadows"
                  : "volume",
            transferFunction: {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              rampLow: transferFunction.rampLow,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              rampHigh: transferFunction.rampHigh,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              red: transferFunction.color.x,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              green: transferFunction.color.y,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              blue: transferFunction.color.z,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              comment: transferFunction.comment ?? `transferFunction_${index}`,
            },
          });
        }
      }

      self.setVizualizedVolume(vizualizedVolume);

      console.log("File reading done.");
      window.WasmModule.open_volume();
    }),
  }));

export interface UiStateInstance extends Instance<typeof UiState> {}
export interface UiStateSnapshotIn extends SnapshotIn<typeof UiState> {}
