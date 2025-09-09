// @ts-check

import DatabaseModel from "./database-model.mjs";
import path from "path";
import fsPromises from "node:fs/promises";
import prismaManager from "../tools/prisma-manager.mjs";
import appConfig from "../tools/config.mjs";
import fileSystem from "fs";
import { unpackFiles } from "../tools/file-handler.mjs";
import fileUpload from "express-fileupload";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").Checkpoint } CheckpointDB
 */

export default class Checkpoint extends DatabaseModel {
    static checkpointFolder = "checkpoints";
    static acceptedFileExtensions = [".ckpt"];
    static modelName = "checkpoint";
    static lockManager = new WriteLockManager(this.modelName);

    static get db() {
        return prismaManager.db.checkpoint;
    }

    /**
     * @param {number} id
     * @returns {Promise<CheckpointDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number} modelId
     * @returns {Promise<CheckpointDB[]>}
     */
    static async getFromModel(modelId) {
        const checkpoints = await this.db.findMany({
            where: {
                model: {
                    id: modelId,
                },
            },
        });

        return checkpoints;
    }

    /**
     * @param {number[]} ids
     * @returns {Promise<CheckpointDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
    }

    /**
     * @param {number} creatorId
     * @param {number} modelId
     * @returns {Promise<CheckpointDB>}
     */
    static async create(creatorId, modelId) {
        return prismaManager.db.$transaction(async (tx) => {
            let checkpoint = await tx[this.modelName].create({
                data: {
                    creatorId: creatorId,
                    models: {
                        connect: { id: modelId },
                    },
                },
            });

            const folderPath = await this.#createFolder(checkpoint);

            try {
                checkpoint = await tx.checkpoint.update({
                    where: { id: checkpoint.id },
                    data: { folderPath: folderPath },
                });
            } catch (error) {
                await fsPromises.rm(checkpoint.folderPath, {
                    recursive: true,
                    force: true,
                });
                throw error;
            }
            return checkpoint;
        });
    }

    /**
     * @param {number} creatorId
     * @param {number} modelId
     * @param {fileUpload.UploadedFile[]} files
     * @returns {Promise<CheckpointDB[]>}
     */
    static async createFromFiles(creatorId, modelId, files) {
        const unpackedFiles = await unpackFiles(
            files,
            this.acceptedFileExtensions
        );
        /** @type {CheckpointDB[]} */
        const result = [];

        for (const unpackedFile of unpackedFiles) {
            result.push(
                await prismaManager.db.$transaction(
                    async (tx) => {
                        /** @type {CheckpointDB} */
                        let checkpoint = await tx.checkpoint.create({
                            data: {
                                creatorId: creatorId,
                                modelId,
                            },
                        });

                        const folderPath = await this.#createFolder(checkpoint);
                        const filePath = await unpackedFile.saveAs(folderPath);

                        try {
                            checkpoint = await tx.checkpoint.update({
                                where: { id: checkpoint.id },
                                data: {
                                    folderPath: folderPath,
                                    filePath: filePath,
                                },
                            });
                        } catch (error) {
                            await fsPromises.rm(folderPath, {
                                recursive: true,
                                force: true,
                            });
                            throw error;
                        }
                        return checkpoint;
                    },
                    {
                        timeout: 60000,
                    }
                )
            );
        }

        return result;
    }

    /**
     * @param {number} creatorId
     * @param {number} modelId
     * @param {number[]} labelIds
     * @param {string} folderPath
     * @param {string} filePath
     */
    static async createFromFolder(
        creatorId,
        modelId,
        labelIds,
        folderPath,
        filePath
    ) {
        try {
            return await prismaManager.db.$transaction(
                async (tx) => {
                    /** @type {CheckpointDB} */
                    let checkpoint = await tx.checkpoint.create({
                        data: {
                            creatorId: creatorId,
                            modelId,
                            labels: {
                                connect: labelIds.map((id) => ({ id })),
                            },
                        },
                    });

                    const checkpointPath = await Checkpoint.reserveFolderName(
                        checkpoint.id
                    );
                    await fsPromises.rename(folderPath, checkpointPath);
                    const checkpointFilePath = path.join(
                        checkpointPath,
                        path.basename(filePath)
                    );

                    try {
                        checkpoint = await tx.checkpoint.update({
                            where: { id: checkpoint.id },
                            data: {
                                folderPath: checkpointPath,
                                filePath: checkpointFilePath,
                            },
                        });
                    } catch (error) {
                        await fsPromises.rm(checkpointPath, {
                            recursive: true,
                            force: true,
                        });
                        throw error;
                    }
                    return checkpoint;
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
            throw error;
        }
    }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.CheckpointUpdateInput} changes
     * @returns {Promise<CheckpointDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} checkpointId
     * @returns {Promise<CheckpointDB>}
     */
    static async del(checkpointId) {
        return await this.withWriteLock(checkpointId, null, () => {
            return this.db.delete({
                where: { id: checkpointId },
            });
        });
        // const fileDeleteStack = [];

        // const checkpoint = await prismaManager.db.$transaction(
        //     async (tx) => {
        //         let checkpoint = await tx.checkpoint.findUnique({
        //             where: { id: checkpointId },
        //             include: {
        //                 models: modelId !== null,
        //                 results: true,
        //                 labels: true,
        //             },
        //         });

        //         if (
        //             modelId &&
        //             !checkpoint.models.some((m) => m.id === modelId)
        //         ) {
        //             throw new ApiError(
        //                 400,
        //                 "Checkpoint is not part of the model."
        //             );
        //         }

        //         if (!modelId && checkpoint.results.length > 0) {
        //             throw new ApiError(
        //                 400,
        //                 "Cannot remove checkpoint as long as its referenced in at least one result."
        //             );
        //         }

        //         if (
        //             modelId &&
        //             (checkpoint.models.length > 1 ||
        //                 checkpoint.results.length > 0)
        //         ) {
        //             await tx.checkpoint.update({
        //                 where: {
        //                     id: checkpointId,
        //                 },
        //                 data: {
        //                     models: {
        //                         disconnect: { id: modelId },
        //                     },
        //                 },
        //             });
        //         } else {
        //             await this.withWriteLock(checkpointId, null, () => {
        //                 return tx.checkpoint.delete({
        //                     where: { id: checkpointId },
        //                 });
        //             });

        //             fileDeleteStack.push(
        //                 ...(await PseudoLabeledVolumeData.deleteZombies(
        //                     checkpoint.labels.map((l) => l.id),
        //                     tx
        //                 ))
        //             );

        //             if (checkpoint.folderPath) {
        //                 await fsPromises.rm(checkpoint.folderPath, {
        //                     recursive: true,
        //                     force: true,
        //                 });
        //             }
        //         }
        //         return checkpoint;
        //     },
        //     {
        //         timeout: 60000,
        //     }
        // );

        // for (const file of fileDeleteStack) {
        //     fsPromises
        //         .rm(file, { recursive: true, force: true })
        //         .catch((error) => {
        //             console.error(`Failed to delete ${file}: ${error}`);
        //         });
        // }

        // return checkpoint;
    }

    /**
     * @param {CheckpointDB} checkpoint
     */
    static async #createFolder(checkpoint) {
        const folderPath = path.join(
            appConfig.dataPath,
            this.checkpointFolder,
            checkpoint.id.toString()
        );
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new ApiError(400, `Checkpoint directory already exists`);
            } else {
                await fsPromises.rm(folderPath, {
                    recursive: true,
                    force: true,
                });
            }
        }
        fileSystem.mkdirSync(folderPath, { recursive: true });
        return folderPath;
    }

    /**
     * @param {CheckpointDB} checkpoint
     * @returns {string[]}
     */
    static getFilePaths(checkpoint) {
        return [checkpoint.folderPath];
    }

    /**
     * @param {number} id
     * @returns {Promise<string>}
     */
    static async reserveFolderName(id) {
        const checkpointFolderPath = path.join(
            appConfig.dataPath,
            this.checkpointFolder
        );
        const folderPath = path.join(checkpointFolderPath, id.toString());
        await fsPromises.mkdir(checkpointFolderPath, { recursive: true });
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new ApiError(400, `Checkpoint directory already exists`);
            } else {
                await fsPromises.rm(folderPath, {
                    recursive: true,
                    force: true,
                });
            }
        }
        return folderPath;
    }
}
