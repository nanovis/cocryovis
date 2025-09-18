// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "node:fs/promises";
import appConfig from "../tools/config.mjs";
import path from "path";
import fileSystem from "fs";
import RawVolumeData from "./raw-volume-data.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";
import ResultFile from "./resultFile.mjs";
import fileUpload from "express-fileupload";
import { PendingFile } from "../tools/file-handler.mjs";
import Utils from "../tools/utils.mjs";
import VolumeData from "./volume-data.mjs";

/**
 * @typedef { import("@prisma/client").Result } ResultDB
 */

export default class Result extends DatabaseModel {
    static resultsFolder = "results";
    static acceptedFileExtensions = [".log", ".raw", ".json"];
    static modelName = "result";
    static lockManager = new WriteLockManager(this.modelName);

    static get db() {
        return prismaManager.db.result;
    }

    /**
     * @param {number} id
     * @returns {Promise<ResultDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number} volumeId
     * @param {object} options
     * @param {boolean} [options.checkpoint]
     * @param {boolean} [options.volume]
     * @param {boolean} [options.files]
     */
    static async getFromVolume(
        volumeId,
        { checkpoint = false, volume = false, files = false }
    ) {
        const results = await this.db.findMany({
            where: {
                volumeId,
            },
            include: {
                checkpoint: checkpoint,
                volume: volume,
                files: files,
            },
        });

        return results;
    }

    /**
     * @param {number} id
     * @param {object} options
     * @param {boolean} [options.checkpoint]
     * @param {boolean} [options.volume]
     * @param {boolean} [options.files]
     */
    static async getByIdDeep(
        id,
        { checkpoint = false, volume = false, files = false }
    ) {
        const result = await this.db.findUnique({
            where: {
                id: id,
            },
            include: {
                checkpoint: checkpoint,
                volume: volume,
                files: files,
            },
        });
        if (result === null) {
            throw MissingResourceError.fromId(id, this.modelName);
        }
        return result;
    }

    /**
     * @param {number} creatorId
     * @param {number} checkpointId
     * @param {number} volumeId
     */
    static async create(creatorId, checkpointId, volumeId) {
        return await this.db.create({
            data: {
                creatorId: creatorId,
                checkpointId: checkpointId,
                volumeId: volumeId,
            },
        });
    }

    /**
     * @param {number} creatorId
     * @param {number} checkpointId
     * @param {number} volumeId
     * @typedef {object} Config
     * @property {string} name
     * @property {string} rawFileName
     * @property {string} settingsFileName
     * @property {number} index
     * @property {boolean?} rawVolumeChannel
     * @param {Config[]} config
     * @param {string} folderPath
     * @param {string?} logFile
     */
    static async createFromFolder(
        creatorId,
        checkpointId,
        volumeId,
        config,
        folderPath,
        logFile = null
    ) {
        const resultsFolderPath = path.join(
            appConfig.dataPath,
            this.resultsFolder
        );
        if (!fileSystem.existsSync(resultsFolderPath)) {
            fileSystem.mkdirSync(resultsFolderPath, {
                recursive: true,
            });
        }

        let resultPath = null;

        try {
            return await prismaManager.db.$transaction(
                async (tx) => {
                    /** @type {ResultDB} */
                    let result = await tx.result.create({
                        data: {
                            creatorId: creatorId,
                            checkpointId: checkpointId,
                            volumeId: volumeId,
                        },
                    });

                    resultPath = await Result.reserveFolderName(result.id);
                    await fsPromises.rename(folderPath, resultPath);

                    let rawVolumeChannel = null;

                    for (const fileDescriptor of config) {
                        const rawFilePath = path.join(
                            resultPath,
                            fileDescriptor.rawFileName
                        );
                        const settingsFilePath = path.join(
                            resultPath,
                            fileDescriptor.settingsFileName
                        );
                        if (
                            !fileSystem.existsSync(rawFilePath) ||
                            !fileSystem.existsSync(settingsFilePath)
                        ) {
                            throw new ApiError(
                                500,
                                "Failed result creation: One of the volume files is missing."
                            );
                        }
                        const settingFile =
                            await fsPromises.readFile(settingsFilePath);
                        const settings = JSON.parse(
                            settingFile.toString("utf8")
                        );
                        if (!settings.transferFunction) {
                            settings.transferFunction = Result.#getTFName(
                                fileDescriptor.name
                            );
                            await fsPromises.writeFile(
                                settingsFilePath,
                                JSON.stringify(settings, null, 2),
                                "utf8"
                            );
                        }
                        await ResultFile.create(
                            fileDescriptor.name,
                            fileDescriptor.rawFileName,
                            fileDescriptor.settingsFileName,
                            fileDescriptor.index,
                            result.id,
                            tx
                        );

                        if (fileDescriptor.rawVolumeChannel) {
                            if (rawVolumeChannel !== null) {
                                throw new ApiError(
                                    500,
                                    "Failed result creation: Two volumes marked as raw volume channel."
                                );
                            }
                            rawVolumeChannel = fileDescriptor.index;
                        }
                    }

                    result = await tx.result.update({
                        where: { id: result.id },
                        data: {
                            folderPath: resultPath,
                            rawVolumeChannel: rawVolumeChannel,
                            logFile: logFile,
                        },
                    });

                    return result;
                },
                {
                    timeout: 60000,
                }
            );
        } catch (error) {
            if (resultPath !== null) {
                await fsPromises.rm(resultPath, {
                    recursive: true,
                    force: true,
                });
            }
            await fsPromises.rm(folderPath, {
                recursive: true,
                force: true,
            });
            throw error;
        }
    }

    /**
     * @param {number} creatorId
     * @param {number} checkpointId
     * @param {number} volumeId
     * @param {{name: string, index: number, rawVolumeChannel?: boolean}[]} volumeDescriptors
     * @param {fileUpload.UploadedFile[]} files
     */
    static async createFromFiles(
        creatorId,
        checkpointId,
        volumeId,
        volumeDescriptors,
        files
    ) {
        const volumeData = await RawVolumeData.getFromVolumeIdWithData(volumeId);

        if (!volumeData.dataFile.rawFilePath) {
            throw new ApiError(
                400,
                "Source Volume Data is missing a raw file."
            );
        }

        const pendingFiles = files.map((file) => new PendingFile(file));

        const settings = VolumeData.toSettingSchema(volumeData);

        const resultsFolderPath = path.join(
            appConfig.dataPath,
            this.resultsFolder
        );

        fsPromises.mkdir(resultsFolderPath, {
            recursive: true,
        });

        let resultPath = null;
        let meanFilteredTmpFolder = null;
        let meanFilteredFilePath = null;

        if (
            !volumeDescriptors.some(
                (volume) => volume?.rawVolumeChannel === true
            )
        ) {
            await fsPromises.mkdir(
                path.join(appConfig.tempPath, "mean-filter"),
                {
                    recursive: true,
                }
            );
            meanFilteredTmpFolder = await fsPromises.mkdtemp(
                path.join(appConfig.tempPath, "mean-filter") + "/"
            );
            meanFilteredFilePath = path.join(
                meanFilteredTmpFolder,
                "tmp_mean_filtered.raw"
            );
            await Utils.meanFilter(
                volumeData.dataFile.rawFilePath,
                settings.size.x,
                settings.size.y,
                settings.size.z,
                meanFilteredFilePath
            );
        }

        try {
            return await prismaManager.db.$transaction(
                async (tx) => {
                    /** @type {ResultDB} */
                    let result = await tx.result.create({
                        data: {
                            creatorId: creatorId,
                            checkpointId: checkpointId,
                            volumeId: volumeId,
                        },
                    });

                    resultPath = await Result.reserveFolderName(
                        result.id,
                        true
                    );

                    let rawVolumeChannel = null;

                    for (const [i, pendingFile] of pendingFiles.entries()) {
                        const settingFile = {
                            ...settings,
                            transferFunction: "",
                        };
                        settingFile.file = pendingFile.filteredFileName;
                        settingFile.transferFunction = Result.#getTFName(
                            volumeDescriptors[i].name
                        );
                        const settingFileName = `${Utils.stripExtension(
                            pendingFile.filteredFileName
                        )}.json`;

                        await pendingFile.saveAs(resultPath);
                        await fsPromises.writeFile(
                            path.join(resultPath, settingFileName),
                            JSON.stringify(settingFile, null, 2),
                            "utf8"
                        );

                        await ResultFile.create(
                            volumeDescriptors[i].name,
                            pendingFile.filteredFileName,
                            settingFileName,
                            volumeDescriptors[i].index,
                            result.id,
                            tx
                        );

                        if (volumeDescriptors[i].rawVolumeChannel) {
                            if (rawVolumeChannel !== null) {
                                throw new ApiError(
                                    500,
                                    "Failed result creation: Two volumes marked as raw volume channel."
                                );
                            }
                            rawVolumeChannel = volumeDescriptors[i].index;
                        }
                    }

                    if (meanFilteredFilePath !== null) {
                        const volumeName = "Mean3-Inverted";
                        const meanFilteredFileName = `${Utils.stripExtension(
                            volumeData.dataFile.rawFilePath
                        )}_mean3_inverted.raw`;

                        const settingFile = {
                            ...settings,
                            transferFunction: "",
                        };
                        settingFile.file = meanFilteredFileName;
                        settingFile.transferFunction =
                            Result.#getTFName(volumeName);

                        fsPromises.rename(
                            meanFilteredFilePath,
                            path.join(resultPath, meanFilteredFileName) 
                        );

                        const settingFileName = `${Utils.stripExtension(
                            meanFilteredFileName
                        )}.json`;

                        await fsPromises.writeFile(
                            path.join(resultPath, settingFileName),
                            JSON.stringify(settingFile, null, 2),
                            "utf8"
                        );

                        const usedIndices = volumeDescriptors
                            .map((descriptor) => descriptor.index)
                            .sort((a, b) => a - b);

                        let index = 0;
                        for (let i = 0; i < usedIndices.length; i++) {
                            if (usedIndices[i] !== index) {
                                break;
                            }
                            index++;
                        }

                        rawVolumeChannel = index;

                        await ResultFile.create(
                            volumeName,
                            meanFilteredFileName,
                            settingFileName,
                            index,
                            result.id,
                            tx
                        );
                    }

                    result = await tx.result.update({
                        where: { id: result.id },
                        data: {
                            folderPath: resultPath,
                            rawVolumeChannel: rawVolumeChannel,
                        },
                    });

                    return result;
                },
                {
                    timeout: 60000,
                }
            );
        } catch (error) {
            if (resultPath !== null) {
                await fsPromises.rm(resultPath, {
                    recursive: true,
                    force: true,
                });
            }
            if (meanFilteredFilePath !== null) {
                await fsPromises.rm(meanFilteredFilePath, {
                    recursive: true,
                    force: true,
                });
            }
            throw error;
        } finally {
            if (meanFilteredTmpFolder !== null) {
                await fsPromises.rm(meanFilteredTmpFolder, {
                    recursive: true,
                    force: true,
                });
            }
        }
    }

    /**
     * @param {string} volumeName
     * @returns {string}
     */
    static #getTFName(volumeName) {
        switch (volumeName) {
            case "Spikes":
                return "tf-Spikes.json";
            case "Membrane":
                return "tf-Membrane.json";
            case "Inner":
                return "tf-Inner.json";
            case "Background":
                return "tf-Background.json";
            case "Mean3-Inverted":
                return "tf-raw.json";
            default:
                return "tf-default.json";
        }
    }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.ResultUpdateInput} changes
     * @returns {Promise<ResultDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} resultId
     * @returns {Promise<ResultDB>}
     */
    static async del(resultId) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                const result = await tx.result.delete({
                    where: { id: resultId },
                });

                if (result.folderPath) {
                    fsPromises.rm(result.folderPath, {
                        force: true,
                        recursive: true,
                    });
                }

                return result;
            },
            {
                timeout: 60000,
            }
        );
    }

    /**
     * @param {ResultDB} result
     * @returns {string[]}
     */
    static getFilePaths(result) {
        return [result.folderPath];
    }

    /**
     * @param {number} id
     * @param {boolean} create
     * @returns {Promise<string>}
     */
    static async reserveFolderName(id, create = false) {
        const resultsFolderPath = path.join(
            appConfig.dataPath,
            this.resultsFolder
        );
        const folderPath = path.join(resultsFolderPath, id.toString());
        await fsPromises.mkdir(resultsFolderPath, { recursive: true });
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new ApiError(500, `Result directory already exists`);
            } else {
                await fsPromises.rm(folderPath, {
                    recursive: true,
                    force: true,
                });
            }
        }

        if (create) {
            await fsPromises.mkdir(folderPath, { recursive: true });
        }

        return folderPath;
    }
}
