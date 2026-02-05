import path from "path";
import fileSystem from "fs";
import TaskQueue from "./task-queue";
import Utils from "./utils.mjs";
import fsPromises from "node:fs/promises";
import Checkpoint from "../models/checkpoint.mjs";
import Result, { type ResultConfig } from "../models/result.mjs";
import LogFile from "./log-manager.mjs";
import Volume from "../models/volume.mjs";
import Model from "../models/model.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import PseudoLabeledVolumeData from "../models/pseudo-labeled-volume-data.mjs";
import { WriteMultiLock, type WriteLock } from "./write-lock-manager.mjs";
import { ApiError } from "./error-handler.mjs";
import WebSocketManager, { ActionTypes } from "./websocket-manager.mjs";
import { PendingLocalFile } from "./file-handler.mjs";
import TaskHistory from "../models/task-history.mjs";
import appConfig from "./config.mjs";
import type { AppConfig } from "../types/types";
import type z from "zod";
import { type trainingOptions } from "@cocryovis/schemas/nano-oetzi-path-schema";
import type fileUpload from "express-fileupload";
import type {
  IMODOptions,
  CTFOptions,
  tiltSeriesOptions,
  motionCorrectionOptions,
} from "@cocryovis/schemas/cryoEt-path-schema";
import type { volumeSizeSchema } from "@cocryovis/schemas/componentSchemas/volume-settings-schema";

interface DeepVolume extends VolumeDB {
  rawData: RawVolumeDataWithFileDB;
  pseudoVolumes: PseudoVolumeDataWithFileDB[];
}

interface VolumeConfigData {
  name: string;
  rawDataPath: string;
  labels: string[];
}

export default class GPUTaskHandler {
  private taskQueue: TaskQueue;
  private config: AppConfig;
  private gpuTaskTempDirectory: string;

  constructor(config: AppConfig) {
    this.config = config;
    this.taskQueue = new TaskQueue();
    this.gpuTaskTempDirectory = path.join(this.config.tempPath, "gpuTasks");
    Object.preventExtensions(this);
  }

  isInferenceRunning() {
    return this.taskQueue.hasPendingTask;
  }

  createTemporaryOutputPath() {
    let tempFolderPath = path.join(
      this.gpuTaskTempDirectory,
      Utils.getInverseDateString()
    );
    while (fileSystem.existsSync(tempFolderPath)) {
      tempFolderPath += "_";
    }
    fileSystem.mkdirSync(tempFolderPath, { recursive: true });
    return tempFolderPath;
  }

  async queueInference(
    checkpointId: number,
    volumeId: number,
    userId: number,
    outputPath: string | null = null
  ) {
    if (this.taskQueue.size >= this.config.gpuQueueSize) {
      throw new ApiError(
        400,
        "Failed Attempt to start inference: Too many tasks in queue."
      );
    }

    const rawVolumeData = await RawVolumeData.getWithData(volumeId);
    const checkpoint = await Checkpoint.getById(checkpointId);

    GPUTaskHandler.#checkInferenceInput(rawVolumeData, checkpoint);

    if (!outputPath) {
      outputPath = this.createTemporaryOutputPath();
    }

    const multiLock = new WriteMultiLock([
      Checkpoint.lockManager.generateLockInstance(checkpointId),
      Volume.lockManager.generateLockInstance(volumeId, [
        RawVolumeData.modelName,
      ]),
    ]);

    WriteMultiLock.withWriteMultiLock(multiLock, async () => {
      try {
        const taskHistory = await TaskHistory.create({
          userId: userId,
          volumeId: volumeId,
          checkpointId: checkpointId,
          taskType: TaskHistory.type.Inference,
          taskStatus: TaskHistory.status.enqueued,
          enqueuedTime: new Date(),
        });

        return await this.taskQueue.enqueue(() =>
          this.#runInference(
            checkpointId,
            volumeId,
            userId,
            outputPath,
            taskHistory.id
          )
        );
      } catch {
        console.error(
          `Inference task by User with id ${userId.toString()} failed.`
        );
      }
    });
  }

  async #runInference(
    checkpointId: number,
    volumeId: number,
    userId: number,
    outputPath: string,
    taskHistoryId: number
  ): Promise<ResultDB> {
    const logFile = await LogFile.createLogFile("inference");
    let tempSettingsPath: string | null = null;

    try {
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.running,
        startTime: new Date(),
        logFile: logFile.fileName,
      });

      const rawVolumeData =
        await RawVolumeData.getFromVolumeIdWithData(volumeId);
      const checkpoint = await Checkpoint.getById(checkpointId);

      GPUTaskHandler.#checkInferenceInput(rawVolumeData, checkpoint);

      tempSettingsPath = path.join(
        rawVolumeData.dataFile.path,
        `${Utils.stripExtension(rawVolumeData.dataFile.rawFilePath)}.json`
      );
      const settings = RawVolumeData.toSettingSchema(rawVolumeData);
      await fsPromises.writeFile(
        tempSettingsPath,
        JSON.stringify(settings),
        "utf8"
      );

      await fsPromises.mkdir(outputPath, { recursive: true });

      await logFile.writeLog("Nano-Oetzi inference started\n");

      const inferenceDataAbsolutePath = path.resolve(tempSettingsPath);
      const outputAbsolutePath = path.resolve(outputPath);

      if (!fileSystem.existsSync(outputAbsolutePath)) {
        fileSystem.mkdirSync(outputAbsolutePath, { recursive: true });
      }

      const checkpointAbsolutePath = path.resolve(checkpoint.filePath);
      const params = [
        "./" + this.config.nanoOetzi.inference.command,
        inferenceDataAbsolutePath,
        outputAbsolutePath,
        "-m",
        checkpointAbsolutePath,
      ];
      if (this.config.nanoOetzi.inference.cleanTemporaryFiles) {
        params.push("-c", "True");
      }

      await Utils.runScript(
        this.config.nanoOetzi.python,
        params,
        path.resolve(
          path.join(this.config.nanoOetzi.path, this.config.nanoOetzi.scripts)
        ),
        async (value) => logFile.writeLog(value),
        async (value) => logFile.writeLog(value)
      );

      await logFile.writeLog(
        `\n--------------\nNanoOetzi inference finished\n\nCreating results entry...\n`
      );

      const outputFile = await fsPromises.readFile(
        path.join(outputPath, "output.json"),
        "utf8"
      );

      const result = await Result.createFromFolder(
        userId,
        checkpointId,
        volumeId,
        JSON.parse(outputFile) as ResultConfig[],
        outputPath,
        logFile.fileName
      );

      await logFile.writeLog(
        `Result entry created.\n\nSaving task history...\n`
      );

      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.finished,
        endTime: new Date(),
      });

      await logFile.writeLog(`Task history saved.\n\nINFERENCE FINISHED!\n`);

      WebSocketManager.broadcastAction([userId], [], ActionTypes.InsertResult, {
        result: result,
        volumeId: volumeId,
      });

      return result;
    } catch (error: unknown) {
      const message = Utils.formatError(error);

      await logFile.writeLog(`--------------\n${message}`);
      console.error(`NanoOetzi inference error: ${message}`);
      try {
        await fsPromises.rm(outputPath, {
          recursive: true,
          force: true,
        });
      } catch (error) {
        const message = Utils.formatError(error);
        console.error(`Filed to remove nano oetzi inference cache: ${message}`);
      }
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.failed,
        endTime: new Date(),
      });
      throw error;
    } finally {
      if (tempSettingsPath != null) {
        try {
          await fsPromises.rm(tempSettingsPath, {
            force: true,
          });
        } catch {
          console.error(
            "Inference: Failed to remove the temporary setting file."
          );
        }
      }
    }
  }

  async queueTraining(
    modelId: number,
    userId: number,
    trainingVolumesIds: number[],
    validationVolumesIds: number[],
    testingVolumesIds: number[],
    params: z.infer<typeof trainingOptions>,
    outputPath: string | null = null
  ): Promise<void> {
    if (!trainingVolumesIds || trainingVolumesIds.length == 0) {
      throw new ApiError(
        400,
        "Failed Attempt to start training: Missing training data."
      );
    }
    if (!validationVolumesIds || validationVolumesIds.length == 0) {
      throw new ApiError(
        400,
        "Failed Attempt to start training: Missing validation data."
      );
    }
    if (!testingVolumesIds || testingVolumesIds.length == 0) {
      throw new ApiError(
        400,
        "Failed Attempt to start training: Missing test data."
      );
    }
    if (this.taskQueue.size >= this.config.gpuQueueSize) {
      throw new ApiError(
        400,
        "Failed Attempt to start training: Too many tasks in queue."
      );
    }

    const model = await Model.getById(modelId, { checkpoints: true });
    if (!model) {
      throw new ApiError(
        400,
        "Failed Attempt to start training: Model not found."
      );
    }
    if (params.checkpointId === undefined && model.checkpoints.length > 0) {
      throw new ApiError(
        400,
        "If a checkpoint is not selected, the chosen model must be empty."
      );
    }

    if (params.checkpointId !== undefined) {
      const checkpoint = await Checkpoint.getById(params.checkpointId);
      let foundCheckpoint = false;
      for (const modelCheckpoint of model.checkpoints) {
        if (modelCheckpoint.id == checkpoint.id) {
          foundCheckpoint = true;
          break;
        }
      }
      if (!foundCheckpoint) {
        throw new ApiError(400, "Checkpoint not found in the selected model.");
      }

      if (!checkpoint) {
        throw new ApiError(404, "Checkpoint not found.");
      }
      if (!checkpoint.filePath) {
        throw new ApiError(404, "Checkpoint file not found.");
      }
    }

    this.#checkTrainingInput(params);

    if (!outputPath) {
      outputPath = this.createTemporaryOutputPath();
    }

    const modelLock = Model.lockManager.generateLockInstance(modelId, [
      Checkpoint.modelName,
    ]);

    const volumeLocks: WriteLock[] = [];
    trainingVolumesIds.forEach((v) => {
      volumeLocks.push(
        Volume.lockManager.generateLockInstance(v, [
          RawVolumeData.modelName,
          PseudoLabeledVolumeData.modelName,
        ])
      );
    });

    validationVolumesIds.forEach((v) => {
      volumeLocks.push(
        Volume.lockManager.generateLockInstance(v, [
          RawVolumeData.modelName,
          PseudoLabeledVolumeData.modelName,
        ])
      );
    });

    testingVolumesIds.forEach((v) => {
      volumeLocks.push(
        Volume.lockManager.generateLockInstance(v, [
          RawVolumeData.modelName,
          PseudoLabeledVolumeData.modelName,
        ])
      );
    });

    const multiLock = new WriteMultiLock([modelLock, ...volumeLocks]);

    WriteMultiLock.withWriteMultiLock(multiLock, async () => {
      try {
        const taskHistory = await TaskHistory.create({
          userId: userId,
          modelId: modelId,
          taskType: TaskHistory.type.Training,
          taskStatus: TaskHistory.status.enqueued,
          enqueuedTime: new Date(),
        });

        return await this.taskQueue.enqueue(() =>
          this.#runTraining(
            modelId,
            userId,
            trainingVolumesIds,
            validationVolumesIds,
            testingVolumesIds,
            params,
            outputPath,
            taskHistory.id
          )
        );
      } catch {
        console.error(
          `Training task by User with id ${userId.toString()} failed.`
        );
      }
    });
  }

  #checkTrainingInput(params: z.infer<typeof trainingOptions>) {
    if (params.minEpochs < 1) {
      throw new ApiError(
        400,
        "Training error: Minimum epochs must be greater than 0."
      );
    }
    if (params.maxEpochs < 1) {
      throw new ApiError(
        400,
        "Training error: Maximum epochs must be greater than 0."
      );
    }
    if (params.minEpochs > params.maxEpochs) {
      throw new ApiError(
        400,
        "Training error: Maximum epochs must be greater than minimum epochs."
      );
    }
    if (params.batchSize < 1) {
      throw new ApiError(
        400,
        "Training error: Batch size must be greater than 0."
      );
    }
    if (params.learningRate <= 0) {
      throw new ApiError(
        400,
        "Training error: Learning rate must be greater than 0."
      );
    }
    if (!["mse", "bce", "awl"].includes(params.loss.toLowerCase())) {
      throw new ApiError(400, "Training error: Loss function not supported.");
    }
    if (params.accumulateGradients < 1) {
      throw new ApiError(
        400,
        "Training error: Accumulate gradients must be greater than 0."
      );
    }
    if (
      params.optimizer.toLowerCase() != "adam" &&
      params.optimizer.toLowerCase() != "ranger"
    ) {
      throw new ApiError(400, "Training error: Optimizer not supported.");
    }
  }

  async #runTraining(
    modelId: number,
    userId: number,
    trainingVolumesIds: number[],
    validationVolumesIds: number[],
    testingVolumesIds: number[],
    params: z.infer<typeof trainingOptions>,
    outputPath: string | null,
    taskHistoryId: number
  ): Promise<CheckpointDB> {
    const logFile = await LogFile.createLogFile("training");
    const workFolder = path.join(outputPath, "training-data");

    try {
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.running,
        startTime: new Date(),
        logFile: logFile.fileName,
      });

      await logFile.writeLog("Nano-Oetzi training started\n--------------\n");

      await fsPromises.mkdir(workFolder, { recursive: true });

      await logFile.writeLog(`Creating training configuration file...\n`);

      const trainingVolumes =
        await Volume.getMultipleByIdWithFileDeep(trainingVolumesIds);
      const validationVolumes =
        await Volume.getMultipleByIdWithFileDeep(validationVolumesIds);
      const testingVolumes =
        await Volume.getMultipleByIdWithFileDeep(testingVolumesIds);

      const configPath = await this.#writeTrainingConfigFile(
        trainingVolumes,
        validationVolumes,
        testingVolumes,
        workFolder
      );

      await logFile.writeLog(
        `Training configuration file created successfully.\n`
      );

      const configAbsolutePath = path.resolve(configPath);
      const outputAbsolutePath = path.resolve(workFolder);

      await logFile.writeLog("Converting raw data into pytorch tensors...\n");

      await Utils.runScript(
        this.config.nanoOetzi.python,
        [
          path.join("./python-scripts", "raws-to-train-sets.py"),
          "-i",
          configAbsolutePath,
          "-o",
          outputAbsolutePath,
        ],
        null,
        (value) => logFile.writeLog(value),
        (value) => logFile.writeLog(value)
      );

      await logFile.writeLog(
        `\n--------------\nSuccess.\n\nLauching training script...\n`
      );

      const scriptParams = [
        this.config.nanoOetzi.training.command,
        outputAbsolutePath,
      ];

      if (params.minEpochs !== undefined) {
        scriptParams.push("--min_epochs", params.minEpochs.toString());
      }
      if (params.maxEpochs !== undefined) {
        scriptParams.push("--max_epochs", params.maxEpochs.toString());
      }
      if (params.findLearningRate) {
        scriptParams.push("--find_lr");
      }
      if (params.learningRate !== undefined) {
        scriptParams.push("--learning_rate", params.learningRate.toString());
      }
      if (params.batchSize !== undefined) {
        scriptParams.push("--batch_size", params.batchSize.toString());
      }
      if (params.loss !== undefined) {
        scriptParams.push("--loss", params.loss.toLowerCase());
      }
      if (params.optimizer !== undefined) {
        scriptParams.push("--opt", params.optimizer.toLowerCase());
      }
      if (params.accumulateGradients !== undefined) {
        scriptParams.push(
          "--accumulate-grads",
          params.accumulateGradients.toString()
        );
      }

      if (params.checkpointId !== undefined) {
        const checkpoint = await Checkpoint.getById(params.checkpointId);
        if (!checkpoint) {
          throw new ApiError(400, "Training error: Checkpoint not found.");
        }
        if (!checkpoint.filePath) {
          throw new ApiError(400, "Training error: Checkpoint file not found.");
        }
        const checkpointAbsolutePath = path.resolve(checkpoint.filePath);
        scriptParams.push("--checkpoint", checkpointAbsolutePath);
      }

      await Utils.runScript(
        this.config.nanoOetzi.python,
        scriptParams,
        path.resolve(
          path.join(this.config.nanoOetzi.path, this.config.nanoOetzi.scripts)
        ),
        (value) => logFile.writeLog(value),
        (value) => logFile.writeLog(value)
      );

      await logFile.writeLog(
        `\n--------------\nSuccess.\n\nSearching for training results file...\n`
      );

      const trainingResultsPath = path.join(
        workFolder,
        "results",
        "result.json"
      );
      const trainingResults = await fsPromises.readFile(trainingResultsPath);
      const trainingResultsJSON = JSON.parse(trainingResults.toString()) as {
        best_model_path: string;
      };

      const bestModelPath = trainingResultsJSON.best_model_path;
      const newBestModelPath = path.join(
        outputPath,
        path.basename(bestModelPath)
      );

      await fsPromises.rename(bestModelPath, newBestModelPath);

      const labelIds: number[] = [];
      for (const trainingVolume of trainingVolumes) {
        for (const pseudoVolume of trainingVolume.pseudoVolumes) {
          labelIds.push(pseudoVolume.id);
        }
      }

      await logFile.writeLog(
        `Training results file found.\n\nCreating new checkpoint...\n`
      );

      const checkpoint = await Checkpoint.createFromFolder(
        userId,
        modelId,
        labelIds,
        outputPath,
        newBestModelPath
      );

      await logFile.writeLog(
        `New checkpoint created.\n\nSaving task history...\n`
      );

      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.finished,
        endTime: new Date(),
      });

      await logFile.writeLog(`Task history saved.\n\nTRAINING FINISHED!\n`);

      WebSocketManager.broadcastAction(
        [userId],
        [],
        ActionTypes.InsertCheckpoint,
        { checkpoint: checkpoint, modelId: modelId }
      );

      return checkpoint;
    } catch (error) {
      const message = Utils.formatError(error);
      await logFile.writeLog(`ERROR: \n${message}`);
      console.error(`Nano Oetzi training error: ${message}`);
      try {
        await fsPromises.rm(workFolder, {
          recursive: true,
          force: true,
        });
      } catch (error) {
        const message = Utils.formatError(error);
        console.error(
          `Failed to remove temporary files after a failed Nano-Oetzi training:\n${message}`
        );
      }
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.failed,
        endTime: new Date(),
      });
      throw error;
    } finally {
      if (this.config.nanoOetzi.cleanTemporaryFiles) {
        try {
          await fsPromises.rm(workFolder, {
            recursive: true,
            force: true,
          });
        } catch (error) {
          const message = Utils.formatError(error);
          console.error(
            `Failed to remove temporary files after a failed Nano-Oetzi training:\n${message}`
          );
        }
      }
    }
  }

  /**
   * @param {DeepVolume[]} trainingReferences
   * @param {DeepVolume[]} validationReferences
   * @param {DeepVolume[]} testReferences
   * @param {string} outputPath
   * @returns {Promise<string>}
   */
  async #writeTrainingConfigFile(
    trainingReferences: DeepVolume[],
    validationReferences: DeepVolume[],
    testReferences: DeepVolume[],
    outputPath: string
  ): Promise<string> {
    const configData: {
      train: VolumeConfigData[];
      valid: VolumeConfigData[];
      test: VolumeConfigData[];
      properties: {
        dimensions: z.infer<typeof volumeSizeSchema> | null;
        channels: number | null;
      };
    } = {
      train: [],
      valid: [],
      test: [],
      properties: {
        dimensions: null,
        channels: null,
      },
    };

    this.#prepareTrainingConfigSet(
      trainingReferences,
      configData.train,
      configData.properties
    );
    this.#prepareTrainingConfigSet(
      validationReferences,
      configData.valid,
      configData.properties
    );
    this.#prepareTrainingConfigSet(
      testReferences,
      configData.test,
      configData.properties
    );

    const configFilePath = path.join(outputPath, "trainingConfig.json");
    await fsPromises.writeFile(
      configFilePath,
      JSON.stringify(configData, null, 2),
      "utf-8"
    );
    return configFilePath;
  }

  #prepareTrainingConfigSet(
    references: DeepVolume[],
    configDataArray: VolumeConfigData[],
    properties: {
      dimensions: z.infer<typeof volumeSizeSchema> | null;
      channels: number | null;
    }
  ) {
    for (const reference of references) {
      if (!reference.rawData) {
        throw new ApiError(
          400,
          "NanoOetzi inference error: One or more inputs are missing raw data."
        );
      }
      if (!reference.rawData.dataFile.rawFilePath) {
        throw new ApiError(
          400,
          "NanoOetzi inference error: raw data volume is missing."
        );
      }
      if (reference.pseudoVolumes.length == 0) {
        throw new ApiError(
          400,
          "NanoOetzi inference error: One or more inputs are missing raw data."
        );
      }

      const volumeSettings = RawVolumeData.toSettingSchema(reference.rawData);
      if (volumeSettings.usedBits != 8) {
        throw new ApiError(
          400,
          "NanoOetzi inference error: One or more raw volume data inputs have an unsopported data format."
        );
      }

      if (properties.dimensions == null) {
        properties.dimensions = volumeSettings.size;
      } else {
        GPUTaskHandler.#checkDimensions(
          volumeSettings.size,
          properties.dimensions
        );
      }
      if (properties.channels == null) {
        properties.channels = reference.pseudoVolumes.length;
      } else {
        if (properties.channels != reference.pseudoVolumes.length) {
          throw new ApiError(
            400,
            "NanoOetzi inference error: One or more inputs have missmatching number of pseudo labels."
          );
        }
      }
      const volumeInput: {
        name: string;
        rawDataPath: string;
        labels: string[];
      } = {
        name: reference.name,
        rawDataPath: reference.rawData.dataFile.rawFilePath,
        labels: [],
      };

      for (const pseudoVolume of reference.pseudoVolumes) {
        if (!pseudoVolume.dataFile.rawFilePath) {
          throw new ApiError(
            400,
            "NanoOetzi inference error: One or more pseudo labeled volumes are missing a raw file."
          );
        }
        const pseudoVolumeSettings =
          RawVolumeData.toSettingSchema(pseudoVolume);

        if (pseudoVolumeSettings.usedBits != 8) {
          throw new ApiError(
            400,
            "NanoOetzi inference error: One or more pseudo labeled volumes have an unsopported data format."
          );
        }
        GPUTaskHandler.#checkDimensions(
          pseudoVolumeSettings.size,
          properties.dimensions
        );
        volumeInput.labels.push(pseudoVolume.dataFile.rawFilePath);
      }

      configDataArray.push(volumeInput);
    }
  }

  static #checkDimensions(
    dim1: z.infer<typeof volumeSizeSchema>,
    dim2: z.infer<typeof volumeSizeSchema>
  ) {
    if (!Utils.checkDimensions(dim1, dim2)) {
      throw new ApiError(
        400,
        "NanoOetzi inference error: One or more inputs have missmatching dimensions."
      );
    }
  }

  static #checkInferenceInput(
    rawVolumeData: RawVolumeDataWithFileDB,
    checkpoint: CheckpointDB
  ) {
    if (!rawVolumeData) {
      throw new ApiError(
        400,
        `Inference: Selected Volume must contain Raw Volume Data.`
      );
    }
    if (!rawVolumeData.dataFile.rawFilePath) {
      throw new ApiError(
        400,
        `Inference: Raw Volume Data Volume must contain a raw file.`
      );
    }

    if (!fileSystem.existsSync(checkpoint.filePath)) {
      throw new ApiError(
        400,
        "Failed Attempt to start inference: Checkpoint file does not exist"
      );
    }
  }

  async queueTiltSeriesReconstruction(
    tiltSeriesFile: fileUpload.UploadedFile,
    options: z.infer<typeof tiltSeriesOptions>,
    volumeId: number,
    userId: number
  ): Promise<void> {
    if (this.taskQueue.size >= this.config.gpuQueueSize) {
      throw new ApiError(
        400,
        "Failed Attempt to start tilt series reconstruction: Too many tasks in queue."
      );
    }

    await this.#validateReconstructionInput(tiltSeriesFile, options, volumeId);

    const outputPath = this.createTemporaryOutputPath();

    const multiLock = new WriteMultiLock([
      Volume.lockManager.generateLockInstance(volumeId, [
        RawVolumeData.modelName,
      ]),
    ]);

    WriteMultiLock.withWriteMultiLock(multiLock, async () => {
      try {
        const taskHistory = await TaskHistory.create({
          userId: userId,
          volumeId: volumeId,
          taskType: TaskHistory.type.Reconstruction,
          taskStatus: TaskHistory.status.enqueued,
          enqueuedTime: new Date(),
        });

        return await this.taskQueue.enqueue(() =>
          this.#runTiltSeriesReconstruction(
            tiltSeriesFile,
            options,
            volumeId,
            userId,
            outputPath,
            taskHistory.id
          )
        );
      } catch {
        console.error(
          `Reconstruction task by User with id ${userId.toString()} failed.`
        );
      }
    });
  }
  async #validateReconstructionInput(
    _tiltSeriesFile: fileUpload.UploadedFile,
    _options: z.infer<typeof tiltSeriesOptions>,
    volumeId: number
  ): Promise<void> {
    const volume = await Volume.getById(volumeId);
    if (!volume) {
      throw new ApiError(
        400,
        "Failed Attempt to start tilt series reconstruction: Volume not found."
      );
    }
  }

  async #runTiltSeriesReconstruction(
    tiltSeriesFile: fileUpload.UploadedFile,
    options: z.infer<typeof tiltSeriesOptions>,
    volumeId: number,
    userId: number,
    outputPath: string,
    taskHistoryId: number
  ): Promise<RawVolumeDataDB> {
    const logFile = await LogFile.createLogFile("reconstruction");

    try {
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.running,
        startTime: new Date(),
        logFile: logFile.fileName,
      });

      await this.#validateReconstructionInput(
        tiltSeriesFile,
        options,
        volumeId
      );

      await fsPromises.mkdir(outputPath, { recursive: true });

      let inputFileAbsolutePath = path.resolve(tiltSeriesFile.tempFilePath);

      if (options.alignment !== undefined) {
        inputFileAbsolutePath = await this.#runIMODTiltSeriesAlignment(
          inputFileAbsolutePath,
          outputPath,
          options.alignment,
          logFile
        );
      }

      if (options.motionCorrection !== undefined) {
        inputFileAbsolutePath = await this.#runMotionCor3(
          inputFileAbsolutePath,
          outputPath,
          options.motionCorrection,
          logFile
        );
      }

      if (options.ctf !== undefined) {
        inputFileAbsolutePath = await this.#runGCTFFind(
          inputFileAbsolutePath,
          outputPath,
          options.ctf,
          logFile
        );
      }

      await logFile.writeLog("Tilt series reconstruction started\n");

      const inputFileName = Utils.stripExtension(tiltSeriesFile.name);

      const outputAbsolutePath = path.resolve(
        path.join(outputPath, inputFileName)
      );

      const params = [
        "filename",
        inputFileAbsolutePath,
        "result_filename",
        outputAbsolutePath,
      ];

      if (options.reconstruction) {
        for (const [key, value] of Object.entries(options.reconstruction)) {
          params.push(key);
          params.push(value.toString());
        }
      }

      await Utils.runScript(
        "./" + this.config.Proximal_CryoET.executable,
        params,
        path.resolve(this.config.Proximal_CryoET.path),
        (value) => logFile.writeLog(value),
        (value) => logFile.writeLog(value)
      );

      await logFile.writeLog(
        `\n--------------\nTilt series reconstruction finished\n\nConverting output to raw...\n`
      );

      const { rawFileName, settings } = await Utils.analyzeToRaw(
        outputAbsolutePath + ".hdr",
        outputPath
      );

      const rawFilePath = path.join(outputPath, rawFileName);

      const rawData = await RawVolumeData.createFromFiles(
        userId,
        volumeId,
        [new PendingLocalFile(rawFilePath)],
        settings,
        true
      );

      await logFile.writeLog(`Raw data created.\n\nSaving task history...\n`);

      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.finished,
        endTime: new Date(),
      });

      WebSocketManager.broadcastAction([userId], [], ActionTypes.AddRawData, {
        volumeId: volumeId,
        rawData: rawData,
      });

      await logFile.writeLog(
        `Task history saved.\n\nRECONSTRUCTION FINISHED!\n`
      );

      return rawData;
    } catch (error) {
      const errorMessage = Utils.formatError(error);
      await logFile.writeLog(`ERROR: \n${errorMessage}`);
      console.error(`Tilt series reconstruction error: ${errorMessage}`);
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.failed,
        endTime: new Date(),
      });
      throw error;
    } finally {
      try {
        await fsPromises.rm(outputPath, {
          recursive: true,
          force: true,
        });
      } catch (error) {
        const errorMessage = Utils.formatError(error);
        console.error(
          `Filed to remove nano oetzi inference cache: ${errorMessage}`
        );
      }
      try {
        await fsPromises.rm(tiltSeriesFile.tempFilePath, {
          force: true,
        });
      } catch {
        console.error(
          "Inference: Failed to remove the temporary setting file."
        );
      }
    }
  }

  async #runIMODTiltSeriesAlignment(
    inputPath: string,
    outputFolder: string,
    options: z.infer<typeof IMODOptions>,
    logFile: LogFile
  ): Promise<string> {
    if (!fileSystem.existsSync(inputPath)) {
      throw new ApiError(
        400,
        `CTF estimation: Input file ${inputPath} does not exist.`
      );
    }

    await logFile.writeLog(
      "--------------STARTING IMOD TILT SERIESALIGNMENT\n"
    );

    // 1. Run CCDERASER
    await logFile.writeLog("CCDERASER------\n");
    const baseName = Utils.stripExtension(inputPath);
    const inputAbsolutePath = path.resolve(inputPath);
    const ccderaserOutputPath = path.resolve(
      path.join(outputFolder, baseName + "_ccderaser.mrc")
    );

    // prettier-ignore
    const ccderaserParams = [
      "-input", inputAbsolutePath,
      "-output", ccderaserOutputPath,
      "-find",
    ];

    Utils.checkAndAddParameter(
      options.peak,
      ccderaserParams,
      "-peak",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.diff,
      ccderaserParams,
      "-diff",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.grow,
      ccderaserParams,
      "-grow",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.iterations,
      ccderaserParams,
      "-iterations",
      Utils.isInteger
    );

    await Utils.runScript(
      "ccderaser",
      ccderaserParams,
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );
    await logFile.writeLog(`CCDERASER finished.\n`);

    // 2. Extract tilt angles
    await logFile.writeLog("EXTRACTTILTS------\n");

    const extracttiltsOutputPath = path.resolve(
      path.join(outputFolder, baseName + "_tilts.tlt")
    );
    await Utils.runScript(
      "extracttilts",
      ["-input", ccderaserOutputPath, "-output", extracttiltsOutputPath],
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    // 3. Patch tracking with tiltxcorr
    await logFile.writeLog("TILTXCORR------\n");
    const fidModelOutputPath = path.resolve(
      path.join(outputFolder, baseName + "_patchtrack.fid")
    );

    // prettier-ignore
    const tiltxcorrParams = [
      ccderaserOutputPath,
      fidModelOutputPath,
      "-tiltfile", extracttiltsOutputPath,
    ];

    Utils.checkAndAddParameter(
      options.numOfPatches,
      tiltxcorrParams,
      "-number",
      Utils.isInteger
    );

    Utils.checkAndAddParameter(
      options.patchSize,
      tiltxcorrParams,
      "-size",
      Utils.isInteger
    );

    Utils.checkAndAddParameter(
      options.patchRadius,
      tiltxcorrParams,
      "-radius1",
      Utils.isFloat
    );

    await Utils.runScript(
      "tiltxcorr",
      tiltxcorrParams,
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    // 4. Solve alignment with tiltalign

    await logFile.writeLog("TILTALIGN------\n");

    const transformPath = path.resolve(
      path.join(outputFolder, baseName + "_patchtrack.fid")
    );

    // prettier-ignore
    const tiltAlignParams = [
      "-ModelFile", fidModelOutputPath,
      "-ImageFile", ccderaserOutputPath,
      "-TiltFile", extracttiltsOutputPath,
      "-OutputTransformFile", transformPath,
    ];

    Utils.checkAndAddParameter(
      options.rotationAngle,
      tiltAlignParams,
      "-RotationAngle",
      Utils.isFloat,
      true
    );

    await Utils.runScript(
      "tiltalign",
      tiltAlignParams,
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value),
      [139]
    );

    await logFile.writeLog("NEWSTACK------\n");

    const trimmedPath = path.resolve(
      path.join(outputFolder, baseName + "_trimmed.mrc")
    );

    await Utils.runScript(
      "newstack",
      // prettier-ignore
      [
        "-secs", "1-56",
        "-input", ccderaserOutputPath,
        "-output", trimmedPath
      ],
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    // 5. Apply alignment with newstack
    const alignedPath = path.resolve(
      path.join(outputFolder, baseName + "_aligned.mrc")
    );

    await Utils.runScript(
      "newstack",
      // prettier-ignore
      [
        "-input", trimmedPath,
        "-output", alignedPath,
        "-xform", transformPath,
      ],
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    await logFile.writeLog(
      "--------------IMOD TILT SERIES ALIGNMENT FINISHED\n"
    );

    return alignedPath;
  }

  async #runGCTFFind(
    inputPath: string,
    outputFolder: string,
    options: z.infer<typeof CTFOptions>,
    logFile: LogFile
  ): Promise<string> {
    await logFile.writeLog("--------------STARTING CTF ESTIMATION\n");
    if (!fileSystem.existsSync(inputPath)) {
      throw new ApiError(400, `Input file ${inputPath} does not exist.`);
    }

    const baseName = Utils.stripExtension(inputPath);
    const inputAbsolutePath = path.resolve(inputPath);
    const outputPath = path.resolve(
      path.join(outputFolder, baseName + "_ctf.mrc")
    );

    // prettier-ignore
    const params = [
      "-InMrc", inputAbsolutePath,
      "-OutMrc", outputPath,
      "-Gpu", "0",
    ];

    Utils.checkAndAddParameter(
      options.highTension,
      params,
      "-kV",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.sphericalAberration,
      params,
      "-Cs",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.amplitudeContrast,
      params,
      "-AmpContrast",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.pixelSize,
      params,
      "-PixSize",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.tileSize,
      params,
      "-TileSize",
      Utils.isInteger
    );

    await Utils.runScript(
      "./" + appConfig.GCtfFind.executable,
      params,
      path.resolve(appConfig.GCtfFind.path),
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    await logFile.writeLog("--------------CTF ESTIMATION FINISHED\n");
    return outputPath;
  }

  async #runMotionCor3(
    inputPath: string,
    outputFolder: string,
    options: z.infer<typeof motionCorrectionOptions>,
    logFile: LogFile
  ): Promise<string> {
    await logFile.writeLog("--------------STARTING MOTION CORRECTION\n");
    if (!fileSystem.existsSync(inputPath)) {
      throw new ApiError(400, `Input file ${inputPath} does not exist.`);
    }

    const baseName = Utils.stripExtension(inputPath);
    const inputAbsolutePath = path.resolve(inputPath);
    const outputPath = path.resolve(
      path.join(outputFolder, baseName + "_motion_correcterd.mrc")
    );

    // prettier-ignore
    const params = [
      "-InMrc", inputAbsolutePath,
      "-OutMrc", outputPath,
      "-Gpu", "0",
    ];

    if (options.patchSize !== undefined && Utils.isInteger(options.patchSize)) {
      params.push(
        "-Patch",
        options.patchSize.toString(),
        options.patchSize.toString()
      );
    }
    Utils.checkAndAddParameter(
      options.iterations,
      params,
      "-Iter",
      Utils.isInteger
    );
    Utils.checkAndAddParameter(
      options.tolerance,
      params,
      "-Tol",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.pixelSize,
      params,
      "-PixSize",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.fmDose,
      params,
      "-FmDose",
      Utils.isFloat
    );
    Utils.checkAndAddParameter(
      options.highTension,
      params,
      "-kV",
      Utils.isFloat
    );

    await Utils.runScript(
      "./" + appConfig.MotionCor3.executable,
      params,
      path.resolve(appConfig.MotionCor3.path),
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    await logFile.writeLog("--------------MOTION CORRECTION FINISHED\n");
    return outputPath;
  }
}
