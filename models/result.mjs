// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "node:fs/promises";
import appConfig from "../tools/config.mjs";
import path from "path";
import fileSystem from "fs";
import { readdir, rename } from "node:fs/promises";
import Utils from "../tools/utils.mjs";
import Checkpoint from "./checkpoint.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import RawVolumeData from "./raw-volume-data.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";
import ResultFile from "./resultFile.mjs";

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
     * @param {Number} ownerId
     * @param {Number} checkpointId
     * @param {Number} volumeDataId
     * @param {Number} volumeId
     */
    static async create(ownerId, checkpointId, volumeDataId, volumeId) {
        return await this.db.create({
            data: {
                ownerId: ownerId,
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
     * @param {Number} ownerId
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
        ownerId,
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
                            ownerId: ownerId,
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
                    await rename(folderPath, resultPath);

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
     * @return {Promise<String>}
     */
    static async reserveFolderName(id) {
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
