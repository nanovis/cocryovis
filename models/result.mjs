// @ts-check

import { BaseModel } from "./base-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { rm } from "node:fs/promises";
import appConfig from "../tools/config.mjs";
import path from "path";
import fileSystem from "fs";
import { readdir, rename } from "node:fs/promises";
import { isFileExtensionAccepted } from "../tools/utils.mjs";

/**
 * @typedef { import("@prisma/client").Result } ResultDB
 */

/**
 * @extends BaseModel
 */
export class Result extends BaseModel {
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
     */
    static async create(ownerId, checkpointId, volumeDataId) {
        return await this.db.create({
            data: {
                ownerId: ownerId,
                checkpointId: checkpointId,
                volumeDataId: volumeDataId,
            },
        });
    }

    /**
     * @param {Number} ownerId
     * @param {Number} checkpointId
     * @param {Number} volumeDataId
     * @param {String} folderPath
     */
    static async createFromFolder(
        ownerId,
        checkpointId,
        volumeDataId,
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
                        await rm(resultPath, {
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
            await rm(folderPath, {
                recursive: true,
                force: true,
            });
        }
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {Number} [ownerId]
     * @property {Number} [checkpointId]
     * @property {Number} [volumeDataId]
     * @property {String?} [folderPath]
     * @property {String?} [files]
     * @property {Number?} [rawVolumeChannel]
     * @param {Changes} changes
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
        const result = await super.del(id);
        if (result.folderPath) {
            await rm(result.folderPath, { recursive: true, force: true });
        }
        return result;
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
                await rm(folderPath, { recursive: true, force: true });
            }
        }
        return folderPath;
    }
}
