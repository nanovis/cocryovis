import fileSystem from "fs";
import path from "path";
import fsPromises from "node:fs/promises";
import { H5ToLabels, labelsToH5, rawToH5 } from "./raw-to-h5.mjs";
import Utils from "./utils.mjs";
import TaskQueue from "./task-queue";
import Volume from "../models/volume.mjs";
import appConfig from "./config.mjs";
import LogFile from "./log-manager.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import SparseLabeledVolumeData from "../models/sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "../models/pseudo-labeled-volume-data.mjs";
import { WriteMultiLock } from "./write-lock-manager.mjs";
import { ApiError } from "./error-handler.mjs";
import WebSocketManager, { ActionTypes } from "./websocket-manager.mjs";
import TaskHistory from "../models/task-history.mjs";
import type { AppConfig } from "../types/types";
import type z from "zod";
import type {
  volumeSettings,
  volumeSizeSchema,
} from "@cocryovis/schemas/componentSchemas/volume-settings-schema";

export default class IlastikHandler {
  static rawDataset = "/raw_data";
  static labelsDataset = "/labels";
  static pseudoLabelsDataset = "/pseudo_labels";

  private config: AppConfig;
  private ilastikTempDirectory: string;
  private taskQueue: TaskQueue;

  constructor(config: AppConfig) {
    this.config = config;
    this.taskQueue = new TaskQueue();
    this.ilastikTempDirectory = path.join(this.config.tempPath, "ilastik");
    Object.preventExtensions(this);
  }

  isInferenceRunning() {
    return this.taskQueue.hasPendingTask;
  }

  async queueLabelGeneration(
    volumeId: number,
    userId: number,
    outputPath: string | null = null
  ): Promise<void> {
    if (this.taskQueue.size >= this.config.ilastikQueueSize) {
      throw new ApiError(
        400,
        "Failed Attempt to queue label generation: Too many tasks in queue."
      );
    }

    const volume = await Volume.getByIdWithFileDeep(volumeId);

    IlastikHandler.checkVolumeProperties(volume);

    if (!outputPath) {
      outputPath = Utils.createTemporaryFolder(this.ilastikTempDirectory);
    }

    const multiLock = new WriteMultiLock([
      Volume.lockManager.generateLockInstance(volumeId, [
        RawVolumeData.modelName,
        SparseLabeledVolumeData.modelName,
        PseudoLabeledVolumeData.modelName,
      ]),
    ]);

    WriteMultiLock.withWriteMultiLock(multiLock, async () => {
      try {
        const taskHistory = await TaskHistory.create({
          userId: userId,
          volumeId: volumeId,
          taskType: TaskHistory.type.LabelInference,
          taskStatus: TaskHistory.status.enqueued,
          enqueuedTime: new Date(),
        });

        return await this.taskQueue.enqueue(() =>
          this.generateLabels(volumeId, userId, outputPath, taskHistory.id)
        );
      } catch {
        console.error(
          `Label generation task by User with id ${userId} failed.`
        );
      }
    });
  }

  async runIlastikInference(
    rawDataPath: string,
    modelPath: string,
    labelsOutputPath: string,
    logFile: LogFile
  ): Promise<string> {
    await logFile.writeLog("\n\nIlastik inference started\n");

    const rawDataFullPath =
      path.resolve(rawDataPath) + IlastikHandler.rawDataset;
    const modelFullPath = path.resolve(modelPath);
    const resultsFilePath = path.join(
      labelsOutputPath,
      `${Utils.stripExtension(rawDataPath)}_pseudo_labels.h5`
    );

    await Utils.runScript(
      this.config.ilastik.path + this.config.ilastik.inference,
      [
        "--headless",
        `--project=${modelFullPath}`,
        "--output_format=hdf5",
        "--export_source=Probabilities",
        "--export_dtype=uint8",
        "--pipeline_result_drange=(0.0,1.0)",
        "--export_drange=(0,255)",
        `--output_internal_path=${IlastikHandler.pseudoLabelsDataset}`,
        `--output_filename_format=${resultsFilePath}`,
        rawDataFullPath,
      ],
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    return resultsFilePath;
  }

  private async createIlastikProject(
    rawDataPath: string,
    sparseLabelPath: string,
    outputPath: string,
    logFile: LogFile
  ): Promise<string> {
    await logFile.writeLog("\n\nCreating Ilastik project\n");

    const modelOutputFullPath = path.join(
      path.resolve(outputPath),
      this.config.ilastik.model_file_name
    );
    const rawDataFullPath =
      path.resolve(rawDataPath) + IlastikHandler.rawDataset;
    const sparseLabelFullPath =
      path.resolve(sparseLabelPath) + IlastikHandler.labelsDataset;

    await Utils.runScript(
      this.config.ilastik.python,
      [
        path.join(
          this.config.ilastik.path,
          this.config.ilastik.scripts_path,
          this.config.ilastik.create_project_command
        ),
        modelOutputFullPath,
        rawDataFullPath,
        sparseLabelFullPath,
      ],
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    return modelOutputFullPath;
  }

  private async generateLabels(
    volumeId: number,
    userId: number,
    outputPath: string,
    taskHistoryId: number
  ): Promise<PseudoLabeledVolumeData[]> {
    const logFile = await LogFile.createLogFile("label-generation");

    try {
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.running,
        startTime: new Date(),
        logFile: logFile.fileName,
      });

      const volume = await Volume.getByIdWithFileDeep(volumeId);

      await logFile.writeLog("Stating label generation process\n\n");

      IlastikHandler.checkVolumeProperties(volume);

      const settings = RawVolumeData.toSettingSchema(volume.rawData);

      const rawH5FileName =
        Utils.stripExtension(volume.rawData.dataFile.rawFilePath) + ".h5";
      const labelsH5FileName =
        Utils.stripExtension(volume.rawData.dataFile.rawFilePath) +
        "_labels.h5";

      const rawH5Path = path.join(outputPath, rawH5FileName);
      const labelsH5Path = path.join(outputPath, labelsH5FileName);

      await logFile.writeLog("Converting raw data to HDF5 format...\n");
      await this.convertDataToH5(
        volume.rawData,
        volume.sparseVolumes,
        settings,
        rawH5Path,
        labelsH5Path,
        logFile
      );
      await logFile.writeLog("Data conversion to HDF5 complete.");

      const modelFullPath = await this.createIlastikProject(
        rawH5Path,
        labelsH5Path,
        outputPath,
        logFile
      );

      const resultPath = await this.runIlastikInference(
        rawH5Path,
        modelFullPath,
        outputPath,
        logFile
      );

      const labelDirectory = path.join(outputPath, "labels");
      await fsPromises.mkdir(labelDirectory, {
        recursive: true,
      });
      await H5ToLabels(
        resultPath,
        IlastikHandler.pseudoLabelsDataset,
        labelDirectory,
        logFile
      );

      const pseudoLabeledVolumes = await Volume.addPseudoLabelsFromFolder(
        labelDirectory,
        userId,
        volume.id,
        volume.sparseVolumes
      );

      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.finished,
        endTime: new Date(),
      });

      WebSocketManager.broadcastAction(
        [userId],
        [],
        ActionTypes.InsertPseudoVolumes,
        {
          pseudoLabeledVolumes: pseudoLabeledVolumes,
          volumeId: volumeId,
        }
      );

      return pseudoLabeledVolumes;
    } catch (error) {
      console.error(`Ilastik label generation error: ${error}`);
      await logFile.writeLog(`exec error: ${error}`);
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.failed,
        endTime: new Date(),
      });
      throw error;
    } finally {
      if (appConfig.ilastik.cleanTemporaryFiles) {
        try {
          await fsPromises.rm(outputPath, {
            recursive: true,
            force: true,
          });
        } catch (error) {
          console.error(`Filed to remove ilastik inference cache: ${error}`);
        }
      }
    }
  }

  private async convertDataToH5(
    rawData: RawVolumeDataWithFileDB,
    sparseLabelsStack: SparseVolumeDataWithFileDB[],
    settings: z.infer<typeof volumeSettings>,
    rawOutputPath: string,
    labelsOutputPath: string,
    logFile: LogFile | null = null
  ) {
    if (fileSystem.existsSync(rawOutputPath)) {
      await fsPromises.rm(rawOutputPath, {
        force: true,
      });
    }
    if (fileSystem.existsSync(labelsOutputPath)) {
      await fsPromises.rm(labelsOutputPath, {
        force: true,
      });
    }

    await rawToH5(
      rawData.dataFile.rawFilePath,
      settings.size,
      settings.usedBits,
      settings.isSigned,
      settings.isLittleEndian,
      rawOutputPath,
      IlastikHandler.rawDataset,
      logFile
    );
    await labelsToH5(
      sparseLabelsStack.map((l) => l.dataFile.rawFilePath),
      settings.size,
      labelsOutputPath,
      IlastikHandler.labelsDataset,
      logFile
    );
  }

  private static checkDimensions(
    dim1: z.infer<typeof volumeSizeSchema>,
    dim2: z.infer<typeof volumeSizeSchema>
  ) {
    if (!Utils.checkDimensions(dim1, dim2)) {
      throw new ApiError(
        400,
        "Pseudo Labels Generation error: One or more inputs have missmatching dimensions."
      );
    }
  }

  private static checkVolumeProperties(volume: FullVolumeWithFileDB) {
    if (volume.sparseVolumes.length < 2) {
      throw new ApiError(
        400,
        "Pseudo Labels Generation error: Volume requires at least two manual labels."
      );
    }

    if (
      volume.sparseVolumes.length + volume.pseudoVolumes.length >
      appConfig.maxVolumeChannels
    ) {
      throw new ApiError(
        400,
        "Pseudo Labels Generation error: Volume does not have enough empty space to pseudo label slots."
      );
    }

    if (!volume.rawData || !volume.rawData.dataFile.rawFilePath) {
      throw new ApiError(
        400,
        "Pseudo Labels Generation error: Raw Data is missing."
      );
    }

    for (const sparseLabel of volume.sparseVolumes) {
      if (!sparseLabel || !sparseLabel.dataFile.rawFilePath) {
        throw new ApiError(
          400,
          "Pseudo Labels Generation error: Manual Label Data is missing."
        );
      }
    }

    const settings = RawVolumeData.toSettingSchema(volume.rawData);
    if (!Object.hasOwn(settings, "size")) {
      throw new ApiError(
        400,
        "Pseudo Labels Generation error: Missing data dimensions data."
      );
    }
    const dimensions = settings.size;
    for (const sparseLabel of volume.sparseVolumes) {
      const settings = RawVolumeData.toSettingSchema(sparseLabel);
      if (
        !Object.hasOwn(settings, "bytesPerVoxel") ||
        settings.bytesPerVoxel != 1
      ) {
        throw new ApiError(
          400,
          "Pseudo Labels Generation error: Labels must be in uint8 data format."
        );
      }
      if (!Object.hasOwn(settings, "size")) {
        throw new ApiError(
          400,
          "Pseudo Labels Generation error: Missing data dimensions data."
        );
      }
      IlastikHandler.checkDimensions(dimensions, settings.size);
    }
  }
}
