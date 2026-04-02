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
  protected readonly moduleId: string = this.constructor.name;

  static async installModule(
    _moduleId: string,
    _context: ModuleInstallContext
  ): Promise<void> {
    // No-op by default for modules without an installation step.
  }

  /**
   * Validate that a file or directory exists
   */
  protected validatePathExists(filePath: string): void {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new ApiError(
        500,
        `${this.moduleId} module: ${absolutePath} not found`
      );
    }
  }

  /**
   * Validate that a file exists
   */
  protected validateFileExists(filePath: string): void {
    this.validatePathExists(filePath);
    const absolutePath = path.resolve(filePath);
    if (!fs.statSync(absolutePath).isFile()) {
      throw new ApiError(
        500,
        `${this.moduleId} module: ${absolutePath} is not a file`
      );
    }
  }

  /**
   * Validate that a directory exists
   */
  protected validateDirectoryExists(dirPath: string): void {
    this.validatePathExists(dirPath);
    const absolutePath = path.resolve(dirPath);
    if (!fs.statSync(absolutePath).isDirectory()) {
      throw new ApiError(
        500,
        `${this.moduleId} module: ${absolutePath} is not a directory`
      );
    }
  }
}
