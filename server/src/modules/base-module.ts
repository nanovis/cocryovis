import fs from "fs";
import path from "path";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * Abstract base class for external modules/tools
 * Provides common interface for executing external scripts/executables
 */
export abstract class BaseModule {
  protected readonly moduleName: string;

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
