import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { program } from "commander";
import { BaseModule } from "../modules/base-module";
import type {
  ModuleInstallContext,
  RunInstallCommandOptions,
} from "../modules/base-module";
import {
  moduleInstallerEntrySchema,
  MODULES_CACHE_DIRECTORY,
  MODULES_DIRECTORY,
  MODULES_WRAPPER_DIRECTORY,
  readModuleConfig,
  type ModuleConfig,
} from "./module-config-utils";
import { z } from "zod";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, "..", "..");
const modulesRoot = path.resolve(serverRoot, MODULES_DIRECTORY);
const cacheRoot = path.resolve(serverRoot, MODULES_CACHE_DIRECTORY);
const modulesSourceRoot = path.resolve(serverRoot, MODULES_WRAPPER_DIRECTORY);

interface CliOptions {
  skip: string[];
  only: string[];
}

const isBaseModuleClass = (value: unknown): value is typeof BaseModule =>
  typeof value === "function" && value.prototype instanceof BaseModule;

interface LoadedInstaller {
  moduleId: string;
  aliases: string[];
  install: (context: ModuleInstallContext) => Promise<void>;
}

const isSkipped = (
  skipSet: Set<string>,
  onlySet: Set<string>,
  moduleId: string,
  aliases: string[]
): boolean => {
  const names = [moduleId, ...aliases];
  return (
    (skipSet.size > 0 && names.some((name) => skipSet.has(name))) ||
    (onlySet.size > 0 && !names.some((name) => onlySet.has(name)))
  );
};

const runCommand = async (
  command: string,
  args: string[],
  options: RunInstallCommandOptions
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || (options.allowFail ?? false)) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command failed (${String(code ?? "unknown")}): ${command} ${args.join(" ")}`
        )
      );
    });
  });
};

const ensureDir = async (dirPath: string): Promise<void> => {
  await fs.mkdir(dirPath, { recursive: true });
};

const cleanDirectory = async (
  dirPath: string,
  preserve = new Set([".gitkeep"])
): Promise<void> => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (preserve.has(entry.name)) {
      continue;
    }
    await fs.rm(path.join(dirPath, entry.name), {
      recursive: true,
      force: true,
    });
  }
};

const movePath = async (source: string, destination: string): Promise<void> => {
  await fs.rm(destination, { recursive: true, force: true });
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }

    const stat = await fs.stat(source);
    if (stat.isDirectory()) {
      await fs.cp(source, destination, { recursive: true });
    } else {
      await fs.copyFile(source, destination);
    }
    await fs.rm(source, { recursive: true, force: true });
  }
};

const copyPath = async (source: string, destination: string): Promise<void> => {
  await ensureDir(path.dirname(destination));
  const stat = await fs.stat(source);
  if (stat.isDirectory()) {
    await fs.cp(source, destination, { recursive: true });
    return;
  }

  await fs.copyFile(source, destination);
};

const loadInstallers = async (
  moduleConfig: ModuleConfig
): Promise<LoadedInstaller[]> => {
  const installers: LoadedInstaller[] = [];

  for (const [moduleId, moduleSettings] of Object.entries(moduleConfig)) {
    const entry = moduleInstallerEntrySchema.safeParse(moduleSettings);
    if (!entry.success) {
      continue;
    }

    const modulePath = path.join(modulesSourceRoot, entry.data.moduleFile);
    if (!existsSync(modulePath)) {
      throw new Error(
        `Configured module file for ${moduleId} was not found: ${entry.data.moduleFile}`
      );
    }

    const moduleUrl = pathToFileURL(modulePath).href;
    const imported = (await import(moduleUrl)) as Record<string, unknown>;

    let matchedInstaller:
      | ((context: ModuleInstallContext) => Promise<void>)
      | null = null;
    for (const exportedValue of Object.values(imported)) {
      if (!isBaseModuleClass(exportedValue)) {
        continue;
      }

      if (exportedValue.installModule === BaseModule.installModule) {
        continue;
      }

      matchedInstaller = async (context) =>
        exportedValue.installModule(moduleId, context);
      break;
    }

    if (!matchedInstaller) {
      continue;
    }

    installers.push({
      moduleId,
      aliases: entry.data.aliases ?? [],
      install: matchedInstaller,
    });
  }

  return installers;
};

const parseModuleIdValues = (value: string, previous: string[]): string[] => {
  const parsed = value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return [...previous, ...parsed];
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const main = async (): Promise<void> => {
  program
    .option(
      "--skip <step>",
      "Skip one or more steps (repeat flag or use comma-separated list)",
      parseModuleIdValues,
      []
    )
    .option(
      "--only <step>",
      "Run only the specified step(s) (repeat flag or use comma-separated list)",
      parseModuleIdValues,
      []
    );

  program.parse(process.argv);
  const options = program.opts<CliOptions>();
  const moduleConfig = await readModuleConfig(serverRoot);
  const installers = await loadInstallers(moduleConfig);

  if (installers.length === 0) {
    console.log("[modules] No module installers were found in src/modules.");
    return;
  }

  const skipSet = new Set(options.skip);

  const onlySet = new Set(options.only);

  await ensureDir(cacheRoot);

  const context: ModuleInstallContext = {
    serverRoot,
    modulesRoot,
    cacheRoot,
    runCommand,
    ensureDir,
    cleanDirectory,
    movePath,
    removePath: (targetPath, options) => fs.rm(targetPath, options),
    readDirectory: (dirPath) => fs.readdir(dirPath, { withFileTypes: true }),
    chmod: (targetPath, mode) => fs.chmod(targetPath, mode),
    existsSync,
    getCachePath: (...parts) => path.join(cacheRoot, ...parts),
    cacheGet: async (cachePath, targetPath) => {
      if (!existsSync(cachePath)) {
        return false;
      }

      await copyPath(cachePath, targetPath);
      return true;
    },
    cacheSet: async (sourcePath, cachePath) => {
      if (!existsSync(sourcePath)) {
        return false;
      }

      await copyPath(sourcePath, cachePath);
      return true;
    },
    getEnvValue: (envVars) => {
      for (const envVar of envVars) {
        const envValue = process.env[envVar];
        if (envValue) {
          return envValue;
        }
      }

      return undefined;
    },
    getModuleInstallConfig: (moduleName, schema) => {
      const moduleSection = moduleConfig[moduleName];
      const parsed = z.record(z.string(), z.unknown()).safeParse(moduleSection);
      if (!parsed.success) {
        return schema.parse({});
      }

      return schema.parse(parsed.data);
    },
  };

  for (const installer of installers) {
    if (isSkipped(skipSet, onlySet, installer.moduleId, installer.aliases)) {
      console.log(`\n[modules] Skipping ${installer.moduleId}.`);
      continue;
    }

    console.log(`\n[modules] Running ${installer.moduleId}...`);
    await installer.install(context);
    console.log(`[modules] ${installer.moduleId} completed successfully.`);
  }

  console.log("\n[modules] All selected module steps completed successfully.");
};

main().catch((error: unknown) => {
  console.error(
    `\n[modules] Installation/build failed: ${getErrorMessage(error)}`
  );
  process.exit(1);
});
