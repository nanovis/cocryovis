import fs from "fs";
import path from "path";
import type { z } from "zod";
import { ApiError } from "../tools/error-handler.mjs";

export interface RunInstallCommandOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  allowFail?: boolean;
}

export interface ModuleInstallContext {
  serverRoot: string;
  modulesRoot: string;
  cacheRoot: string;
  runCommand: (
    command: string,
    args: string[],
    options: RunInstallCommandOptions
  ) => Promise<void>;
  ensureDir: (dirPath: string) => Promise<void>;
  cleanDirectory: (dirPath: string, preserve?: Set<string>) => Promise<void>;
  movePath: (source: string, destination: string) => Promise<void>;
  removePath: (
    targetPath: string,
    options?: { recursive?: boolean; force?: boolean }
  ) => Promise<void>;
  readDirectory: (dirPath: string) => Promise<fs.Dirent[]>;
  chmod: (targetPath: string, mode: number) => Promise<void>;
  existsSync: (targetPath: string) => boolean;
  getCachePath: (...parts: string[]) => string;
  cacheGet: (cachePath: string, targetPath: string) => Promise<boolean>;
  cacheSet: (sourcePath: string, cachePath: string) => Promise<boolean>;
  getEnvValue: (envVars: string[]) => string | undefined;
  getModuleInstallConfig: <T>(moduleName: string, schema: z.ZodType<T>) => T;
}

/**
 * Abstract base class for external modules/tools
 * Provides common interface for executing external scripts/executables
 */
export abstract class BaseModule {
  protected readonly moduleName: string;

  static async installModule(
    _moduleId: string,
    _context: ModuleInstallContext
  ): Promise<void> {
    // No-op by default for modules without an installation step.
  }

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  /**
   * Validate that a file or directory exists
   */
  protected validatePathExists(filePath: string, description: string): void {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new ApiError(
        500,
        `${this.moduleName} module: ${description} not found at ${absolutePath}`
      );
    }
  }

  /**
   * Validate that a file exists
   */
  protected validateFileExists(filePath: string, description: string): void {
    this.validatePathExists(filePath, `${description} file`);
    const absolutePath = path.resolve(filePath);
    if (!fs.statSync(absolutePath).isFile()) {
      throw new ApiError(
        500,
        `${this.moduleName} module: ${description} is not a file at ${absolutePath}`
      );
    }
  }

  /**
   * Validate that a directory exists
   */
  protected validateDirectoryExists(
    dirPath: string,
    description: string
  ): void {
    this.validatePathExists(dirPath, description);
    const absolutePath = path.resolve(dirPath);
    if (!fs.statSync(absolutePath).isDirectory()) {
      throw new ApiError(
        500,
        `${this.moduleName} module: ${description} is not a directory at ${absolutePath}`
      );
    }
  }
}
