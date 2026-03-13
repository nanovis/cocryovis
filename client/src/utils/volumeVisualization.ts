import type { VolVisSettingsSnapshotIn } from "@/stores/uiState/VolVisSettings";
import type {
  visualizedObjectInstances,
  VisualizedVolumeInput,
} from "@/stores/uiState/VisualizedVolume";
import {
  RawFileVolumeData,
  type VolumeData,
  VolumeDescriptor,
  volumeSettingsFromJson,
} from "./volumeDescriptor";
import type { VolumeRenderer } from "@/renderer/renderer";
import { visualizationConfigSchema } from "@cocryovis/schemas/componentSchemas/volume-settings-schema";
import type { FileMap } from "./helpers";
import type { VisualizationDescriptor } from "@/renderer/volume/volumeManager";

const CONFIG_FILE_NAME = "config.json";

export async function fileMapToVisualizationConfig(
  fileMap: FileMap
): Promise<VisualizationDescriptor> {
  const visualizationDescriptor: VisualizationDescriptor = {
    descriptors: [],
  };

  const configBlob = fileMap.get(CONFIG_FILE_NAME);
  let settingsFilePaths: string[] | undefined;
  if (configBlob) {
    const configFileContent = await configBlob.text();
    const config = visualizationConfigSchema.parse(
      JSON.parse(configFileContent)
    );
    if (config.files.length === 0) {
      throw new Error("No files found in config.json.");
    }
    settingsFilePaths = config.files;
    if (config.rawVolumeChannel) {
      if (
        config.rawVolumeChannel < config.files.length &&
        config.rawVolumeChannel >= -1
      ) {
        visualizationDescriptor.rawVolumeChannel = config.rawVolumeChannel;
      } else {
        console.warn("Invalid rawVolumeChannel index in config.json.");
      }
    }
  }

  if (!settingsFilePaths) {
    settingsFilePaths = [];
    for (const [filePath, file] of fileMap.entries()) {
      if (file.name !== CONFIG_FILE_NAME && file.name.endsWith(".json")) {
        settingsFilePaths.push(filePath);
      }
    }
  }

  const volumeDataMap = new Map<string, VolumeData>();

  for (const fileName of settingsFilePaths) {
    const data = fileMap.get(fileName);
    if (!data) {
      throw new Error(`Missing volume settings file: ${fileName}`);
    }
    const fileContent = await data.text();
    const settings = volumeSettingsFromJson(fileContent);
    const rawFilePath = settings.file;
    let volumeData = volumeDataMap.get(rawFilePath);
    if (!volumeData) {
      const volumeFile = fileMap.get(rawFilePath);
      if (!volumeFile) {
        throw new Error(`Missing raw volume file: ${rawFilePath}`);
      }
      volumeData = new RawFileVolumeData(volumeFile);
      volumeDataMap.set(rawFilePath, volumeData);
    }
    const volumeDescriptor: VolumeDescriptor = new VolumeDescriptor(
      volumeData,
      settings
    );
    visualizationDescriptor.descriptors.push(volumeDescriptor);
  }

  return visualizationDescriptor;
}

export async function visualizeVolumeFromConfig(
  renderer: VolumeRenderer,
  config: VisualizationDescriptor,
  visualizedObject?: visualizedObjectInstances
): Promise<VisualizedVolumeInput> {
  const volumeVisualizationSettings: VolVisSettingsSnapshotIn[] = [];

  const visualizedVolume: VisualizedVolumeInput = {
    volVisSettings: volumeVisualizationSettings,
    clippingPlaneOffset: 0,
    clippingPlane: "none",
    labelEditingMode: false,
    manualLabelIndex: 0,
    fullscreen: false,
    showRawClippingPlane: false,
    visualizedObject: visualizedObject,
  };

  renderer.clippingPlaneManager.setClippingPlaneOffset(0);
  renderer.clippingPlaneManager.setClippingPlane("none");
  const visualizationDescriptor =
    await renderer.volumeManager.loadVolumes(config);

  for (
    let index = 0;
    index < visualizationDescriptor.descriptors.length;
    index++
  ) {
    const channelData = renderer.volumeManager.channelData.get(index);
    volumeVisualizationSettings.push({
      index: index,
      name: `Volume ${index}`,
      type:
        index === visualizationDescriptor.rawVolumeChannel ? "raw" : "volume",
      transferFunction: {
        rampLow: channelData.rampStart,
        rampHigh: channelData.rampEnd,
        red: Math.round(channelData.color[0] * 255),
        green: Math.round(channelData.color[1] * 255),
        blue: Math.round(channelData.color[2] * 255),
        comment: `transferFunction_${index}`,
      },
    });
  }

  return visualizedVolume;
  //
  // const transferFunctionDefinitions = new Map();
  // let defaultTFIndex = 0;
  //
  // // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
  // for (const [index, fileName] of config.files.entries()) {
  //   const file = filesMap.get(fileName);
  //
  //   if (!file) {
  //     throw new Error(`Missing setting file: ${fileName}`);
  //   }
  //
  //   const fileContent: string = yield file.text();
  //   if (!isAlive(self)) {
  //     return;
  //   }
  //   const settings = JSON.parse(fileContent);
  //
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //   const rawFile = filesMap.get(settings.file);
  //
  //   if (!rawFile) {
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //     throw new Error(`Missing raw file: ${settings.file}`);
  //   }
  //
  //   const rawFileContent = (yield rawFile.arrayBuffer()) as ArrayBuffer;
  //   if (!isAlive(self)) {
  //     return;
  //   }
  //   // const data = new Uint8Array(rawFileContent);
  //
  //   // window.WasmModule.FS.writeFile(settings.file, data);
  //   rootStore.renderer.volume.loadData(rawFileContent);
  //
  //   let transferFunction = null;
  //
  //   // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //   if (settings.transferFunction) {
  //     transferFunction = transferFunctionDefinitions.get(
  //       // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //       settings.transferFunction
  //     );
  //     if (!transferFunction) {
  //       const transferFunctionFile = filesMap.get(
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/restrict-plus-operands
  //         "transfer-functions/" + settings.transferFunction
  //       );
  //       if (!transferFunctionFile) {
  //         console.warn(
  //           // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //           `Missing transfer function file: ${settings.transferFunction}`
  //         );
  //       } else {
  //         const transferFunctionContent = yield transferFunctionFile.text();
  //         if (!isAlive(self)) {
  //           return;
  //         }
  //         // window.WasmModule.FS.writeFile(
  //         //   // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         //   settings.transferFunction,
  //         //   transferFunctionContent
  //         // );
  //
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  //         transferFunction = JSON.parse(transferFunctionContent);
  //
  //         transferFunctionDefinitions.set(
  //           // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //           settings.transferFunction,
  //           transferFunction
  //         );
  //       }
  //     }
  //   }
  //
  //   if (!transferFunction) {
  //     const blankTF =
  //       // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //       (!visualizedObject && config.files.length === 1) ||
  //       (visualizedObject && getType(visualizedObject) === Volume);
  //     const { tfName, tfDefinition } = Utils.pickDefaultTF(
  //       defaultTFIndex,
  //       blankTF
  //     );
  //     defaultTFIndex++;
  //
  //     transferFunction = transferFunctionDefinitions.get(tfName);
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //     settings.transferFunction = tfName;
  //     if (!transferFunction) {
  //       transferFunction = tfDefinition;
  //       transferFunctionDefinitions.set(tfName, transferFunction);
  //       // window.WasmModule.FS.writeFile(
  //       //   tfName,
  //       //   JSON.stringify(transferFunction)
  //       // );
  //     }
  //   }
  //
  //   // window.WasmModule.FS.writeFile(fileName, JSON.stringify(settings));
  //
  //   if (
  //     // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //     index === config.rawVolumeChannel ||
  //     index === CONFIG.shadowsTransferFunctionIndex ||
  //     index < CONFIG.visibleVolumes
  //   ) {
  //     volumeVisualizationSettings.push({
  //       index: index,
  //       // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //       name: settings.name ?? `Volume ${index}`,
  //       type:
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         index === config.rawVolumeChannel
  //           ? "raw"
  //           : index === CONFIG.shadowsTransferFunctionIndex
  //             ? "shadows"
  //             : "volume",
  //       transferFunction: {
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         rampLow: transferFunction.rampLow,
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         rampHigh: transferFunction.rampHigh,
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         red: transferFunction.color.x,
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         green: transferFunction.color.y,
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         blue: transferFunction.color.z,
  //         // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  //         comment: transferFunction.comment ?? `transferFunction_${index}`,
  //       },
  //     });
  //   }
  // }
}
