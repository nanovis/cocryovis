// @ts-check

import { BaseModel } from "./base-model.mjs";
import path from "path";
import fsPromises from "node:fs/promises";
import prismaManager from "../tools/prisma-manager.mjs";
import appConfig from "../tools/config.mjs";
import fileSystem from "fs";
import { unpackFiles } from "../tools/file-handler.mjs";
import fileUpload from "express-fileupload";

/**
 * @typedef { import("@prisma/client").Checkpoint } CheckpointDB
 */

export class Checkpoint extends BaseModel {
    static acceptedFileExtensions = [".ckpt"];

    /**
     * @return {String}
     */
    static get modelName() {
        return "checkpoint";
    }

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
        const unpackedFiles = unpackFiles(files, this.acceptedFileExtensions);
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
        }
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {String?} [filePath]
     * @property {String?} [folderPath]
     * @property {Number} [ownerId]
     * @param {Changes} changes
     * @return {Promise<CheckpointDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    // /**
    //  * @return {import("@prisma/client").PrismaPromise<any>}
    //  */
    static deleteZombies() {
        return this.db.deleteMany({
            where: {
                NOT: {
                    models: { some: {} },
                },
            },
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<CheckpointDB>}
     */
    static async del(id) {
        const checkpoint = await super.del(id);
        if (checkpoint.folderPath) {
            await fsPromises.rm(checkpoint.folderPath, {
                recursive: true,
                force: true,
            });
        }
        return checkpoint;
    }

    /**
     * @param {CheckpointDB} checkpoint
     */
    static async #createFolder(checkpoint) {
        const folderPath = path.join(
            appConfig.projects.checkpointsPath,
            checkpoint.id.toString()
        );
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new Error(`Checkpoint directory already exists`);
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
     * @param {Number} id
     * @return {Promise<String>}
     */
    static async reserveFolderName(id) {
        const folderPath = path.join(
            appConfig.projects.checkpointsPath,
            id.toString()
        );
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new Error(`Checkpoint directory already exists`);
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
