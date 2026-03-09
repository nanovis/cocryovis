import { type PublicUser } from "../models/user.mjs";

declare module "express-session" {
  interface SessionData {
    user?: PublicUser;
  }
}

declare global {
  interface CommonVolumeSettings {
    name: string;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    skipBytes: number;
    isLittleEndian: boolean;
    isSigned: boolean;
    addValue: number;
    bytesPerVoxel: number;
    usedBits: number;
  }
  type RequireFields<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>;

  interface GPUData {
    device_id: number;
    device_name: string;
  }
  interface AppConfig {
    idleSessionExpirationMin: number;
    tempPath: string;
    cookieName: string;
    cleanTempOnStartup: boolean;
    dataPath: string;
    maxVolumeChannels: number;
    safeMode: boolean;
    logPath: string;
    ilastikQueueSize: number;
    gpuQueueSize: number;
    compressionLevel: number;
    python: string;
    demoProjectIndex?: number;
    ilastik: {
      path: string;
      scripts_path: string;
      python: string;
      inference: string;
      create_project_command: string;
      model_file_name: string;
      cleanTemporaryFiles: boolean;
    };
    nanoOetzi: {
      path: string;
      scripts: string;
      python: string;
      meanFiltering: {
        command: string;
      };
      inference: {
        command: string;
        defaultModel: string;
        cleanTemporaryFiles: boolean;
      };
      training: {
        command: string;
        cleanTemporaryFiles: boolean;
      };
      cleanTemporaryFiles?: boolean;
    };
    Proximal_CryoET: {
      path: string;
      executable: string;
    };
    MotionCor3: {
      path: string;
      executable: string;
    };
    GCtfFind: {
      path: string;
      executable: string;
    };
    IMOD: {
      path: string;
    };
  }
}

export {};
