import path from "path";
import { z } from "zod";
import Utils from "../tools/utils.mjs";
import { BaseModule } from "./base-module";
import type { ModuleInstallContext } from "./base-module";
import { ApiError } from "../tools/error-handler.mjs";
import type LogFile from "../tools/log-manager.mjs";

const ILASTIK_ARCHIVE = "ilastik-1.4.0b21-gpu-Linux.tar.gz";
const ILASTIK_GDOWN_ID = "1T1zKnYqRB119wc84iE1rwwvmAgFI5JOa";

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

  static readonly ilastikRoot = "ilastik";
  static readonly pythonPath = path.join(
    IlastikModule.ilastikRoot,
    "bin/python"
  );
  static readonly inferencePath = path.join(
    IlastikModule.ilastikRoot,
    "run_ilastik.sh"
  );
  static readonly createProjectPath = path.join(
    IlastikModule.ilastikRoot,
    "bin/train_headless.py"
  );
  static readonly modelFileName = "ilastik_project.ilp";

  static override async installModule(
    moduleId: string,
    {
      modulesRoot,
      runCommand,
      ensureDir,
      cleanDirectory,
      existsSync,
      getCachePath,
      cacheGet,
      cacheSet,
      removePath,
      movePath,
      readDirectory,
    }: ModuleInstallContext
  ): Promise<void> {
    const ilastikPath = path.join(modulesRoot, "ilastik");
    const runIlastikScript = path.join(
      ilastikPath,
      IlastikModule.inferencePath
    );

    await ensureDir(ilastikPath);

    if (existsSync(runIlastikScript)) {
      console.log(
        "[modules] run_ilastik.sh already exists. Skipping Ilastik install."
      );
      return;
    }
    const extractedDir = "extracted";

    const extractPath = path.join(ilastikPath, extractedDir);

    const archivePath = path.join(ilastikPath, ILASTIK_ARCHIVE);
    const cacheArchivePath = getCachePath(moduleId, ILASTIK_ARCHIVE);

    let hasArchive = existsSync(archivePath);
    if (!hasArchive) {
      hasArchive = await cacheGet(cacheArchivePath, archivePath);
      if (hasArchive) {
        console.log(
          `[modules] Restored ${ILASTIK_ARCHIVE} from cache for ${moduleId}.`
        );
      }
    }

    if (hasArchive) {
      console.log(
        `[modules] ${ILASTIK_ARCHIVE} already exists. Skipping download.`
      );
      await cleanDirectory(ilastikPath, new Set([".gitkeep", ILASTIK_ARCHIVE]));
    } else {
      await cleanDirectory(ilastikPath);
      await runCommand("python3", ["-m", "venv", "./venv"], {
        cwd: ilastikPath,
      });
      await runCommand("./venv/bin/pip", ["install", "--upgrade", "pip"], {
        cwd: ilastikPath,
      });
      await runCommand("./venv/bin/pip", ["install", "--upgrade", "gdown"], {
        cwd: ilastikPath,
      });
      await runCommand(
        "./venv/bin/gdown",
        [ILASTIK_GDOWN_ID, "-O", ILASTIK_ARCHIVE],
        { cwd: ilastikPath }
      );

      await cacheSet(archivePath, cacheArchivePath);

      await removePath(path.join(ilastikPath, "venv"), {
        recursive: true,
        force: true,
      });
    }

    await ensureDir(extractPath);
    await runCommand(
      "tar",
      ["-xf", `./${ILASTIK_ARCHIVE}`, "-C", `./${extractedDir}`],
      {
        cwd: ilastikPath,
      }
    );

    const items = await readDirectory(extractPath);
    const dir = items.find((item) => item.isDirectory());
    if (!dir) throw new Error("No directory found");

    await movePath(
      path.join(extractPath, dir.name),
      path.join(ilastikPath, IlastikModule.ilastikRoot)
    );

    await removePath(extractPath, { force: true, recursive: true });
    await removePath(archivePath, { force: true });
  }

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
