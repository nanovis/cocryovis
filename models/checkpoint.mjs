// @ts-check

import DatabaseModel from "./database-model.mjs";
import path from "path";
import fsPromises from "node:fs/promises";
import prismaManager from "../tools/prisma-manager.mjs";
import appConfig from "../tools/config.mjs";
import fileSystem from "fs";
import { unpackFiles } from "../tools/file-handler.mjs";
import fileUpload from "express-fileupload";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Model from "./model.mjs";
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
     * @param {Number} id
     * @return {Promise<CheckpointDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} modelId
     * @return {Promise<CheckpointDB[]>}
     */
    static async getFromModel(modelId) {
        const checkpoints = await this.db.findMany({
            where: {
                models: {
                    some: {
                        id: modelId,
                    },
                },
            },
        });

        return checkpoints;
    }

    /**
     * @param {Number[]} ids
     * @return {Promise<CheckpointDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} modelId
     * @return {Promise<CheckpointDB>}
     */
    static async create(ownerId, modelId) {
        return prismaManager.db.$transaction(async (tx) => {
            let checkpoint = await tx[this.modelName].create({
                data: {
                    ownerId: ownerId,
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
     * @param {Number} ownerId
     * @param {Number} modelId
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<CheckpointDB[]>}
     */
    static async createFromFiles(ownerId, modelId, files) {
        const unpackedFiles = await unpackFiles(files, this.acceptedFileExtensions);
        /** @type {CheckpointDB[]} */
        const result = [];

        for (const unpackedFile of unpackedFiles) {
            result.push(
                await prismaManager.db.$transaction(
                    async (tx) => {
                        /** @type {CheckpointDB} */
                        let checkpoint = await tx.checkpoint.create({
                            data: {
                                ownerId: ownerId,
                                models: {
                                    connect: { id: modelId },
                                },
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
     * @param {Number} ownerId
     * @param {Number} modelId
     * @param {Number[]} labelIds
     * @param {String} folderPath
     * @param {String} filePath
     */
    static async createFromFolder(
        ownerId,
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
                            ownerId: ownerId,
                            models: {
                                connect: { id: modelId },
                            },
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
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.CheckpointUpdateInput} changes
     * @return {Promise<CheckpointDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
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

        const checkpoints = await tx.checkpoint.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    models: {
                        none: {},
                    },
                    results: {
                        none: {},
                    },
                },
            },
        });

        if (checkpoints.length === 0) {
            return [];
        }

        const idsToDelete = checkpoints.map((c) => c.id);

        return this.withWriteLocks(idsToDelete, null, async () => {
            await tx.checkpoint.deleteMany({
                where: {
                    id: {
                        in: idsToDelete,
                    },
                },
            });

            /** @type {String[]} */
            const fileDeleteStack = [];

            checkpoints.forEach((c) =>
                fileDeleteStack.push(...this.getFilePaths(c))
            );

            return fileDeleteStack;
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<CheckpointDB>}
     */
    static async del(id) {
        return this.#del(id);
    }

    /**
     * @param {Number} checkpointId
     * @param {Number?} modelId
     * @return {Promise<CheckpointDB>}
     */
    static async removeFromModel(checkpointId, modelId) {
        return Model.withWriteLock(checkpointId, [this.modelName], () => {
            return this.#del(checkpointId, modelId);
        });
    }

    /**
     * @param {Number} checkpointId
     * @param {Number?} modelId
     * @return {Promise<CheckpointDB>}
     */
    static async #del(checkpointId, modelId = null) {
        const fileDeleteStack = [];

        const checkpoint = await prismaManager.db.$transaction(
            async (tx) => {
                let checkpoint = await tx.checkpoint.findUnique({
                    where: { id: checkpointId },
                    include: {
                        models: modelId !== null,
                        results: true,
                        labels: true,
                    },
                });

                if (
                    modelId &&
                    !checkpoint.models.some((m) => m.id === modelId)
                ) {
                    throw new ApiError(
                        400,
                        "Checkpoint is not part of the model."
                    );
                }

                if (!modelId && checkpoint.results.length > 0) {
                    throw new ApiError(
                        400,
                        "Cannot remove checkpoint as long as its referenced in at least one result."
                    );
                }

                if (
                    modelId &&
                    (checkpoint.models.length > 1 ||
                        checkpoint.results.length > 0)
                ) {
                    await tx.checkpoint.update({
                        where: {
                            id: checkpointId,
                        },
                        data: {
                            models: {
                                disconnect: { id: modelId },
                            },
                        },
                    });
                } else {
                    await this.withWriteLock(checkpointId, null, () => {
                        return tx.checkpoint.delete({
                            where: { id: checkpointId },
                        });
                    });

                    fileDeleteStack.push(
                        ...(await PseudoLabeledVolumeData.deleteZombies(
                            checkpoint.labels.map((l) => l.id),
                            tx
                        ))
                    );

                    if (checkpoint.folderPath) {
                        await fsPromises.rm(checkpoint.folderPath, {
                            recursive: true,
                            force: true,
                        });
                    }
                }
                return checkpoint;
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

        return checkpoint;
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
     * @returns {String[]}
     */
    static getFilePaths(checkpoint) {
        return [checkpoint.folderPath];
    }

    /**
     * @param {Number} id
     * @return {Promise<String>}
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
