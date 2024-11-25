// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "node:fs/promises";
import appConfig from "../tools/config.mjs";
import path from "path";
import fileSystem from "fs";
import Checkpoint from "./checkpoint.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import RawVolumeData from "./raw-volume-data.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";
import ResultFile from "./resultFile.mjs";
import fileUpload from "express-fileupload";
import { PendingFile } from "../tools/file-handler.mjs";
import Utils from "../tools/utils.mjs";

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
     * @param {Number} id
     * @return {Promise<ResultDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} volumeId
     */
    static async getFromVolume(
        volumeId,
        {
            checkpoint = false,
            volumeData = false,
            volumes = false,
            files = false,
        }
    ) {
        const results = await this.db.findMany({
            where: {
                volumes: {
                    some: {
                        id: volumeId,
                    },
                },
            },
            include: {
                checkpoint: checkpoint,
                volumeData: volumeData,
                volumes: volumes,
                files: files,
            },
        });

        return results;
    }

    /**
     * @param {Number} id
     */
    static async getByIdDeep(
        id,
        {
            checkpoint = false,
            volumeData = false,
            volumes = false,
            files = false,
        }
    ) {
        const result = await this.db.findUnique({
            where: {
                id: id,
            },
            include: {
                checkpoint: checkpoint,
                volumeData: volumeData,
                volumes: volumes,
                files: files,
            },
        });
        if (result === null) {
            throw MissingResourceError.fromId(id, this.modelName);
        }
        return result;
    }

    /**
     * @param {Number} creatorId
     * @param {Number} checkpointId
     * @param {Number} volumeDataId
     * @param {Number} volumeId
     */
    static async create(creatorId, checkpointId, volumeDataId, volumeId) {
        return await this.db.create({
            data: {
                creatorId: creatorId,
                checkpointId: checkpointId,
                volumeDataId: volumeDataId,
                volumes: {
                    connect: {
                        id: volumeId,
                    },
                },
            },
        });
    }

    /**
     * @param {Number} creatorId
     * @param {Number} checkpointId
     * @param {Number} volumeDataId
     * @param {Number} volumeId
     * @typedef {Object} Config
     * @property {String} name
     * @property {String} rawFileName
     * @property {String} settingsFileName
     * @property {Number} index
     * @property {Boolean?} rawVolumeChannel
     * @param {Config[]} config
     * @param {String} folderPath
     * @param {String?} logFile
     */
    static async createFromFolder(
        creatorId,
        checkpointId,
        volumeDataId,
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
                            volumeDataId: volumeDataId,
                            volumes: {
                                connect: {
                                    id: volumeId,
                                },
                            },
                        },
                    });

                    resultPath = await Result.reserveFolderName(result.id);
                    await fsPromises.rename(folderPath, resultPath);

                    let rawVolumeChannel = null;

                    for (const fileDescriptor of config) {
                        if (
                            !fileSystem.existsSync(
                                path.join(
                                    resultPath,
                                    fileDescriptor.rawFileName
                                )
                            ) ||
                            !fileSystem.existsSync(
                                path.join(
                                    resultPath,
                                    fileDescriptor.settingsFileName
                                )
                            )
                        ) {
                            throw new ApiError(
                                500,
                                "Failed result creation: One of the volume files is missing."
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
     * @param {Number} creatorId
     * @param {Number} checkpointId
     * @param {Number} volumeDataId
     * @param {Number} volumeId
     * @param {{name: String, index: Number, rawVolumeChannel: Boolean?}[]} volumeDescriptors,
     * @param {fileUpload.UploadedFile[]} files
     */
    static async createFromFiles(
        creatorId,
        checkpointId,
        volumeDataId,
        volumeId,
        volumeDescriptors,
        files
    ) {
        const volumeData = await RawVolumeData.getById(volumeDataId);

        if (!volumeData.rawFilePath) {
            throw new ApiError(
                400,
                "Source Volume Data is missing a raw file."
            );
        }

        if (!volumeData.settings) {
            throw new ApiError(
                400,
                "Source Volume Data is missing a settings file."
            );
        }

        const pendingFiles = files.map((file) => new PendingFile(file));

        const settings = JSON.parse(volumeData.settings);

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
                volumeData.rawFilePath,
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
                            volumeDataId: volumeDataId,
                            volumes: {
                                connect: {
                                    id: volumeId,
                                },
                            },
                        },
                    });

                    resultPath = await Result.reserveFolderName(
                        result.id,
                        true
                    );

                    let rawVolumeChannel = null;

                    for (const [i, pendingFile] of pendingFiles.entries()) {
                        const settingFile = { ...settings };
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
                            volumeData.rawFilePath
                        )}_mean3_inverted.raw`;

                        const settingFile = { ...settings };
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
     * @param {String} volumeName
     * @returns {String}
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
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.ResultUpdateInput} changes
     * @return {Promise<ResultDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<ResultDB>}
     */
    static async del(id) {
        return this.#del(id);
    }

    /**
     * @param {Number} resultId
     * @param {Number} volumeId
     * @return {Promise<ResultDB>}
     */
    static async removeFromVolume(resultId, volumeId) {
        return Volume.withWriteLock(volumeId, [this.modelName], () => {
            return this.#del(resultId, volumeId);
        });
    }

    /**
     * @param {Number} resultId
     * @param {Number?} volumeId
     * @return {Promise<ResultDB>}
     */
    static async #del(resultId, volumeId = null) {
        const fileDeleteStack = [];

        const result = await prismaManager.db.$transaction(
            async (tx) => {
                let result = await tx.result.findUnique({
                    where: { id: resultId },
                    include: {
                        volumes: volumeId !== null,
                        checkpoint: {
                            include: {
                                labels: true,
                            },
                        },
                        volumeData: true,
                    },
                });

                if (
                    volumeId &&
                    !result.volumes.some((v) => v.id === volumeId)
                ) {
                    throw new ApiError(
                        400,
                        "Result is not part of the volume."
                    );
                }

                if (volumeId && result.volumes.length > 1) {
                    await tx.result.update({
                        where: {
                            id: resultId,
                        },
                        data: {
                            volumes: {
                                disconnect: { id: volumeId },
                            },
                        },
                    });
                } else {
                    await this.withWriteLock(resultId, null, () => {
                        return tx.result.delete({
                            where: { id: resultId },
                        });
                    });

                    if (result.checkpoint) {
                        const checkpointFiles = await Checkpoint.deleteZombies(
                            [result.checkpoint.id],
                            tx
                        );

                        if (checkpointFiles.length > 0) {
                            fileDeleteStack.push(...checkpointFiles);

                            fileDeleteStack.push(
                                ...(await PseudoLabeledVolumeData.deleteZombies(
                                    result.checkpoint.labels.map((l) => l.id),
                                    tx
                                ))
                            );
                        }
                    }

                    if (result.volumeData) {
                        fileDeleteStack.push(
                            ...(await RawVolumeData.deleteZombies(
                                [result.volumeData.id],
                                tx
                            ))
                        );
                    }

                    if (result.folderPath) {
                        fsPromises.rm(result.folderPath, {
                            force: true,
                            recursive: true,
                        });
                    }
                }
                return result;
            },
            {
                timeout: 60000,
            }
        );

        for (const file of fileDeleteStack) {
            fsPromises
                .rm(file, { recursive: true, force: true })
                .catch((error) => {
                    console.error(`Failed to delete ${file}: ${error}`);
                });
        }

        return result;
    }

    /**
     * @param {ResultDB} result
     * @return {String[]}
     */
    static getFilePaths(result) {
        return [result.folderPath];
    }

    /**
     * @param {Number} id
     * @param {Boolean} create
     * @return {Promise<String>}
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

    /**
     * @param {Number[]} ids
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @return {Promise<String[]>}
     */
    static async deleteZombies(ids, tx) {
        if (ids.length === 0) {
            return [];
        }

        const results = await tx.result.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    volumes: {
                        none: {},
                    },
                },
            },
        });

        if (results.length === 0) {
            return [];
        }

        const idsToDelete = results.map((r) => r.id);

        return this.withWriteLocks(idsToDelete, null, async () => {
            await tx.result.deleteMany({
                where: {
                    id: {
                        in: results.map((r) => r.id),
                    },
                },
            });

            /** @type {String[]} */
            const fileDeleteStack = [];

            results.forEach((r) =>
                fileDeleteStack.push(...Result.getFilePaths(r))
            );

            return fileDeleteStack;
        });
    }
}
