import path from "path";
import { z } from "zod";
import Utils from "../tools/utils.mjs";
import { BaseModule } from "./base-module";
import { ApiError } from "../tools/error-handler.mjs";
import type LogFile from "../tools/log-manager.mjs";

export const ilastikConfigSchema = z.object({
  path: z.string().min(1),
  cleanTemporaryFiles: z.boolean().optional(),
});

export type IlastikConfig = z.infer<typeof ilastikConfigSchema>;

/**
 * Ilastik Module - Wraps Ilastik for label generation and inference
 */
export class IlastikModule extends BaseModule {
  static readonly rawDataset = "/raw_data";
  static readonly labelsDataset = "/labels";
  static readonly pseudoLabelsDataset = "/pseudo_labels";

  static readonly pythonPath = "bin/python";
  static readonly inferencePath = "run_ilastik.sh";
  static readonly createProjectPath = "bin/train_headless.py";
  static readonly modelFileName = "ilastik_project.ilp";

  protected ilastikConfig: IlastikConfig;

  constructor(config: IlastikConfig) {
    super("Ilastik");
    this.ilastikConfig = config;
    this.validateConfiguration();
  }

  validateConfiguration(): void {
    this.validateDirectoryExists(this.ilastikConfig.path, "Ilastik directory");
    this.validateFileExists(
      path.join(this.ilastikConfig.path, IlastikModule.pythonPath),
      "Ilastik python interpreter"
    );
    this.validateFileExists(
      path.join(this.ilastikConfig.path, IlastikModule.inferencePath),
      "Ilastik inference script"
    );
    this.validateFileExists(
      path.join(this.ilastikConfig.path, IlastikModule.createProjectPath),
      "Ilastik create project script"
    );
  }

  /**
   * Run Ilastik headless inference on raw data with trained model
   */
  async runInference(
    rawDataPath: string,
    modelPath: string,
    labelsOutputPath: string,
    logFile: LogFile
  ): Promise<string> {
    if (!rawDataPath || !modelPath || !labelsOutputPath) {
      throw new ApiError(
        400,
        "Ilastik: Raw data path, model path, and output path are required"
      );
    }

    await logFile.writeLog("\n\nIlastik inference started\n");

    const rawDataFullPath =
      path.resolve(rawDataPath) + IlastikModule.rawDataset;
    const modelFullPath = path.resolve(modelPath);
    const resultsFilePath = path.join(
      labelsOutputPath,
      `${Utils.stripExtension(rawDataPath)}_pseudo_labels.h5`
    );

    const inferenceParams = [
      "--headless",
      `--project=${modelFullPath}`,
      "--output_format=hdf5",
      "--export_source=Probabilities",
      "--export_dtype=uint8",
      "--pipeline_result_drange=(0.0,1.0)",
      "--export_drange=(0,255)",
      `--output_internal_path=${IlastikModule.pseudoLabelsDataset}`,
      `--output_filename_format=${resultsFilePath}`,
      rawDataFullPath,
    ];

    await Utils.runScript(
      this.ilastikConfig.path + IlastikModule.inferencePath,
      inferenceParams,
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    return resultsFilePath;
  }

  /**
   * Create a new Ilastik project from raw data and sparse labels
   */
  async createProject(
    rawDataPath: string,
    sparseLabelPath: string,
    outputPath: string,
    logFile: LogFile
  ): Promise<string> {
    if (!rawDataPath || !sparseLabelPath || !outputPath) {
      throw new ApiError(
        400,
        "Ilastik: Raw data, sparse labels, and output paths are required"
      );
    }

    await logFile.writeLog("\n\nCreating Ilastik project\n");

    const modelOutputFullPath = path.join(
      path.resolve(outputPath),
      IlastikModule.modelFileName
    );
    const rawDataFullPath =
      path.resolve(rawDataPath) + IlastikModule.rawDataset;
    const sparseLabelFullPath =
      path.resolve(sparseLabelPath) + IlastikModule.labelsDataset;

    const projectParams = [
      path.join(this.ilastikConfig.path, IlastikModule.createProjectPath),
      modelOutputFullPath,
      rawDataFullPath,
      sparseLabelFullPath,
    ];

    await Utils.runScript(
      this.ilastikConfig.path + IlastikModule.pythonPath,
      projectParams,
      null,
      (value) => logFile.writeLog(value),
      (value) => logFile.writeLog(value)
    );

    return modelOutputFullPath;
  }

  /**
   * Check if temporary files should be cleaned up based on config
   */
  shouldCleanTemporaryFiles(): boolean {
    return this.ilastikConfig.cleanTemporaryFiles ?? true;
  }
}
