// @ts-check

import DatabaseModel from "./base-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "node:fs/promises";
import appConfig from "../tools/config.mjs";
import path from "path";
import fileSystem from "fs";
import { readdir, rename } from "node:fs/promises";
import { isFileExtensionAccepted } from "../tools/utils.mjs";
import Checkpoint from "./checkpoint.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import RawVolumeData from "./raw-volume-data.mjs";

/**
 * @typedef { import("@prisma/client").Result } ResultDB
 */

/**
 * @extends DatabaseModel
 */
export default class Result extends DatabaseModel {
    static acceptedFileExtensions = [".log", ".raw", ".json"];

    /**
     * @return {String}
     */
    static get modelName() {
        return "result";
    }

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
     * @param {String} folderPath
     */
    static async createFromFolder(
        ownerId,
        checkpointId,
        volumeDataId,
        volumeId,
        folderPath
    ) {
        if (!fileSystem.existsSync(appConfig.projects.resultsPath)) {
            fileSystem.mkdirSync(appConfig.projects.resultsPath, {
                recursive: true,
            });
        }

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

                    const resultPath = await Result.reserveFolderName(
                        result.id
                    );
                    await rename(folderPath, resultPath);

                    let visualizationFileIndex = 0;
                    let rawVolumeChannel = -1;

                    const filePaths = [];

                    const files = await readdir(resultPath);
                    for (const fileName of files) {
                        const filePath = path.join(resultPath, fileName);
                        if (
                            isFileExtensionAccepted(
                                fileName,
                                this.acceptedFileExtensions
                            )
                        ) {
                            filePaths.push(filePath);

                            if (filePath.endsWith("_inverted.json")) {
                                rawVolumeChannel = filePaths.length - 1;
                            } else if (
                                isFileExtensionAccepted(fileName, [
                                    ".raw",
                                    ".json",
                                ])
                            ) {
                                visualizationFileIndex++;
                            }
                        }
                    }

                    const filePathsJSON = JSON.stringify(filePaths);

                    try {
                        result = await tx.result.update({
                            where: { id: result.id },
                            data: {
                                folderPath: resultPath,
                                rawVolumeChannel: rawVolumeChannel,
                                files: filePathsJSON,
                            },
                        });
                    } catch (error) {
                        await fsPromises.rm(resultPath, {
                            recursive: true,
                            force: true,
                        });
                        throw error;
                    }
                    return result;
                },
                {
                    timeout: 60000,
                }
            );
        } catch (error) {
            await fsPromises.rm(folderPath, {
                recursive: true,
                force: true,
            });
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
        return this.#del(resultId, volumeId);
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
                    throw new Error("Result is not part of the volume.");
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
                    await tx.result.delete({
                        where: { id: resultId },
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
        const folderPath = path.join(
            appConfig.projects.resultsPath,
            id.toString()
        );
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new Error(`Result directory already exists`);
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
        const fileDeleteStack = [];

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
        await tx.result.deleteMany({
            where: {
                id: {
                    in: results.map((r) => r.id),
                },
            },
        });
        results.forEach((r) => fileDeleteStack.push(...Result.getFilePaths(r)));

        return fileDeleteStack;
    }
}
