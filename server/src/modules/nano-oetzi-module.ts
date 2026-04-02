import path from "path";
import fs from "fs";
import fsPromises from "node:fs/promises";
import { z } from "zod";
import Utils from "../tools/utils.mjs";
import { BaseModule } from "./base-module";
import { ApiError } from "../tools/error-handler.mjs";
import type LogFile from "../tools/log-manager.mjs";

export const nanoOetziConfigSchema = z.object({
  path: z.string().min(1),
  pythonPath: z.string().min(1),
  inference: z.object({
    defaultModel: z.string().min(1),
    cleanTemporaryFiles: z.boolean().optional(),
  }),
  training: z.object({
    cleanTemporaryFiles: z.boolean().optional(),
  }),
});

export type NanoOetziConfig = z.infer<typeof nanoOetziConfigSchema>;

/**
 * NanoOetzi Module - Wraps Nano-Oetzi for inference and training
 */
export class NanoOetziModule extends BaseModule {
  protected nanoOetziConfig: NanoOetziConfig;

  static readonly scriptsDirectory = "segmentation";
  static readonly meanFilteringCommand = "mean_filtering.py";
  static readonly inferenceCommand = "inference_script.py";
  static readonly trainingCommand = "train.py";

  constructor(config: NanoOetziConfig) {
    super();
    this.nanoOetziConfig = config;
    this.validateConfiguration();
  }

  validateConfiguration(): void {
    this.validateDirectoryExists(this.nanoOetziConfig.path);
    this.validateFileExists(
      path.join(
        this.nanoOetziConfig.path,
        NanoOetziModule.scriptsDirectory,
        NanoOetziModule.meanFilteringCommand
      )
    );
    this.validateFileExists(
      path.join(
        this.nanoOetziConfig.path,
        NanoOetziModule.scriptsDirectory,
        NanoOetziModule.inferenceCommand
      )
    );
    this.validateFileExists(
      path.join(
        this.nanoOetziConfig.path,
        NanoOetziModule.scriptsDirectory,
        NanoOetziModule.trainingCommand
      )
    );
  }

  /**
   * Run Nano-Oetzi inference on a volume
   */
  async runInference(
    inferenceDataPath: string,
    checkpointPath: string,
    outputPath: string,
    gpuId: number,
    logFile?: LogFile
  ): Promise<void> {
    if (!inferenceDataPath || !checkpointPath || !outputPath) {
      throw new ApiError(
        400,
        "NanoOetzi: Inference data, checkpoint, and output paths are required"
      );
    }

    await logFile?.writeLog("Nano-Oetzi inference started\n");

    const inferenceDataAbsolutePath = path.resolve(inferenceDataPath);
    const outputAbsolutePath = path.resolve(outputPath);
    const checkpointAbsolutePath = path.resolve(checkpointPath);

    if (!fs.existsSync(outputAbsolutePath)) {
      fs.mkdirSync(outputAbsolutePath, { recursive: true });
    }

    // prettier-ignore
    const params = [
      path.join("./", NanoOetziModule.inferenceCommand),
      inferenceDataAbsolutePath,
      outputAbsolutePath,
      "-m", checkpointAbsolutePath,
      "--gpu", gpuId.toString(),
    ];

    if (this.nanoOetziConfig.inference.cleanTemporaryFiles) {
      params.push("-c", "True");
    }

    await Utils.runScript(
      this.nanoOetziConfig.pythonPath,
      params,
      path.resolve(
        path.join(this.nanoOetziConfig.path, NanoOetziModule.scriptsDirectory)
      ),
      async (value) => logFile?.writeLog(value),
      async (value) => logFile?.writeLog(value)
    );

    await logFile?.writeLog(
      "\n--------------\nNanoOetzi inference finished\n\nCreating results entry...\n"
    );
  }

  /**
   * Run Nano-Oetzi training
   */
  async runTraining(
    configPath: string,
    outputPath: string,
    gpuId: number,
    logFile?: LogFile
  ): Promise<void> {
    if (!configPath || !outputPath) {
      throw new ApiError(
        400,
        "NanoOetzi: Config path and output path are required"
      );
    }

    await logFile?.writeLog("Nano-Oetzi training started\n");

    // prettier-ignore
    const params = [
      path.join("./", NanoOetziModule.trainingCommand),
      configPath,
      outputPath,
      "--device", gpuId.toString(),
    ];

    await Utils.runScript(
      this.nanoOetziConfig.pythonPath,
      params,
      path.resolve(
        path.join(this.nanoOetziConfig.path, NanoOetziModule.scriptsDirectory)
      ),
      async (value) => logFile?.writeLog(value),
      async (value) => logFile?.writeLog(value)
    );

    await logFile?.writeLog("\n--------------\nNanoOetzi training finished\n");
  }

  /**
   * Run mean filtering on a volume
   */
  async runMeanFiltering(
    inputPath: string,
    outputPath: string,
    logFile?: LogFile
  ): Promise<void> {
    if (!inputPath || !outputPath) {
      throw new ApiError(400, "NanoOetzi: Input and output paths are required");
    }

    await logFile?.writeLog("Nano-Oetzi mean filtering started\n");

    const params = [
      path.join("./", NanoOetziModule.meanFilteringCommand),
      inputPath,
      outputPath,
    ];

    await Utils.runScript(
      this.nanoOetziConfig.pythonPath,
      params,
      path.resolve(
        path.join(this.nanoOetziConfig.path, NanoOetziModule.scriptsDirectory)
      ),
      async (value) => logFile?.writeLog(value),
      async (value) => logFile?.writeLog(value)
    );

    await logFile?.writeLog(
      "\n--------------\nNanoOetzi mean filtering finished\n"
    );
  }

  /**
   * Write settings file for NanoOetzi inference
   */
  static async writeSettingsFile(
    filePath: string,
    settings: {
      usedBits: number;
      isSigned: boolean;
      isLittleEndian: boolean;
      addValue: number;
      skipBytes: number;
      bytesPerVoxel: number;
      sizeX: number;
      sizeY: number;
      sizeZ: number;
    },
    outputPath: string
  ): Promise<void> {
    const nanoOetziSettings = {
      file: path.basename(filePath),
      usedBits: settings.usedBits,
      isSigned: settings.isSigned,
      isLittleEndian: settings.isLittleEndian,
      addValue: settings.addValue,
      skipBytes: settings.skipBytes,
      bytesPerVoxel: settings.bytesPerVoxel,
      size: {
        x: settings.sizeX,
        y: settings.sizeY,
        z: settings.sizeZ,
      },
    };
    return fsPromises.writeFile(
      outputPath,
      JSON.stringify(nanoOetziSettings),
      "utf8"
    );
  }

  /**
   * Check if inference temporary files should be cleaned up
   */
  shouldCleanInferenceTemporaryFiles(): boolean {
    return this.nanoOetziConfig.inference.cleanTemporaryFiles ?? true;
  }

  /**
   * Check if training temporary files should be cleaned up
   */
  shouldCleanTrainingTemporaryFiles(): boolean {
    return this.nanoOetziConfig.training.cleanTemporaryFiles ?? true;
  }
}
