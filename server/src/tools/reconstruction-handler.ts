import path from "path";
import Utils from "./utils.mjs";
import LogFile from "./log-manager.mjs";
import Volume from "../models/volume.mjs";
import RawVolumeData from "../models/raw-volume-data.mjs";
import { WriteMultiLock, type WriteLock } from "./write-lock-manager.mjs";
import { ApiError } from "./error-handler.mjs";
import WebSocketManager, { ActionTypes } from "./websocket-manager.mjs";
import { PendingLocalFile } from "./file-handler.mjs";
import TaskHistory from "../models/task-history.mjs";
import appConfig from "./config.mjs";
import type z from "zod";
import type fileUpload from "express-fileupload";
import type {
  IMODOptions,
  CTFOptions,
  tiltSeriesOptions,
  motionCorrectionOptions,
} from "@cocryovis/schemas/cryoEt-path-schema";
import type GPUTaskHandler from "./gpu-task-handler";
import fs from "fs";

export default class ReconstructionHandler {
  private static readonly tempDirectory = "reconstruction-tasks";

  constructor(
    private gpuTaskHandler: GPUTaskHandler,
    private config: AppConfig
  ) {}

  async queueTiltSeriesReconstruction(
    tiltSeriesFile: fileUpload.UploadedFile,
    options: z.infer<typeof tiltSeriesOptions>,
    volumeId: number,
    userId: number
  ): Promise<void> {
    if (!this.gpuTaskHandler.canRunTask()) {
      throw new ApiError(
        400,
        "Failed Attempt to start tilt series reconstruction: Too many tasks in queue."
      );
    }

    await this.validateReconstructionInput(tiltSeriesFile, options, volumeId);

    const outputPath = this.createTemporaryOutputPath();

    const multiLock = new WriteMultiLock([
      Volume.lockManager.generateLockInstance(volumeId, [
        RawVolumeData.modelName,
      ]),
    ]);

    WriteMultiLock.withWriteMultiLock(multiLock, async () => {
      let taskHistory: TaskHistoryDB | null = null;
      try {
        taskHistory = await TaskHistory.create({
          userId: userId,
          volumeId: volumeId,
          taskType: TaskHistory.type.Reconstruction,
          taskStatus: TaskHistory.status.enqueued,
          enqueuedTime: new Date(),
        });

        const gpuId = this.gpuTaskHandler.requestGPU();
        if (gpuId === null) {
          throw new ApiError(
            400,
            "Failed Attempt to start tilt series reconstruction: No available GPU."
          );
        }

        return await this.gpuTaskHandler.queueGPUTask(() =>
          this.runTiltSeriesReconstruction(
            tiltSeriesFile,
            options,
            volumeId,
            userId,
            outputPath,
            gpuId,
            taskHistory.id
          )
        );
      } catch (error) {
        if (taskHistory) {
          try {
            await TaskHistory.update(taskHistory.id, {
              taskStatus: TaskHistory.status.failed,
              endTime: new Date(),
            });
          } catch (error) {
            const message = Utils.formatError(error);
            console.error(message);
          }
        }
        console.error(
          `Reconstruction task by User with id ${userId.toString()} failed.`
        );
      }
    });
  }

  private async validateReconstructionInput(
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

  private async runTiltSeriesReconstruction(
    tiltSeriesFile: fileUpload.UploadedFile,
    options: z.infer<typeof tiltSeriesOptions>,
    volumeId: number,
    userId: number,
    outputPath: string,
    gpuId: number,
    taskHistoryId: number
  ): Promise<RawVolumeDataDB> {
    const logFile = await LogFile.createLogFile("reconstruction");

    try {
      await TaskHistory.update(taskHistoryId, {
        taskStatus: TaskHistory.status.running,
        startTime: new Date(),
        logFile: logFile.fileName,
      });

      await this.validateReconstructionInput(tiltSeriesFile, options, volumeId);

      await fs.promises.mkdir(outputPath, { recursive: true });

      let inputFileAbsolutePath = path.resolve(tiltSeriesFile.tempFilePath);

      if (options.alignment !== undefined) {
        inputFileAbsolutePath = await this.runIMODTiltSeriesAlignment(
          inputFileAbsolutePath,
          outputPath,
          options.alignment,
          logFile
        );
      }

      if (options.motionCorrection !== undefined) {
        inputFileAbsolutePath = await this.runMotionCor3(
          inputFileAbsolutePath,
          outputPath,
          options.motionCorrection,
          gpuId,
          logFile
        );
      }

      if (options.ctf !== undefined) {
        inputFileAbsolutePath = await this.runGCTFFind(
          inputFileAbsolutePath,
          outputPath,
          options.ctf,
          gpuId,
          logFile
        );
      }

      await logFile.writeLog("Tilt series reconstruction started\n");

      const inputFileName = Utils.stripExtension(tiltSeriesFile.name);

      const outputAbsolutePath = path.resolve(
        path.join(outputPath, inputFileName)
      );
      
      // prettier-ignore
      const params = [
        "filename", inputFileAbsolutePath,
        "result_filename", outputAbsolutePath,
        "gpu", gpuId.toString(),
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
      this.gpuTaskHandler.releaseGPU(gpuId);
      try {
        await fs.promises.rm(outputPath, {
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
        await fs.promises.rm(tiltSeriesFile.tempFilePath, {
          force: true,
        });
      } catch {
        console.error(
          "Inference: Failed to remove the temporary setting file."
        );
      }
    }
  }

  private async runIMODTiltSeriesAlignment(
    inputPath: string,
    outputFolder: string,
    options: z.infer<typeof IMODOptions>,
    logFile: LogFile
  ): Promise<string> {
    if (!fs.existsSync(inputPath)) {
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

  private async runGCTFFind(
    inputPath: string,
    outputFolder: string,
    options: z.infer<typeof CTFOptions>,
    gpuId: number,
    logFile: LogFile
  ): Promise<string> {
    await logFile.writeLog("--------------STARTING CTF ESTIMATION\n");
    if (!fs.existsSync(inputPath)) {
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
      "-Gpu", gpuId.toString(),
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

  private async runMotionCor3(
    inputPath: string,
    outputFolder: string,
    options: z.infer<typeof motionCorrectionOptions>,
    gpuId: number,
    logFile: LogFile
  ): Promise<string> {
    await logFile.writeLog("--------------STARTING MOTION CORRECTION\n");
    if (!fs.existsSync(inputPath)) {
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
      "-Gpu", gpuId.toString(),
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

  private createTemporaryOutputPath() {
    return Utils.createTemporaryFolder(
      path.join(this.config.tempPath, ReconstructionHandler.tempDirectory)
    );
  }
}
