// @ts-check

import path from "path";
import Utils from "../tools/utils.mjs";
import VolumeData from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "node:fs/promises";
import { PendingUpload } from "../tools/file-handler.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import appConfig from "../tools/config.mjs";
import archiver from "archiver";

/**
 * @import z from "zod"
 * @import { volumeSettings } from "#schemas/componentSchemas/volume-settings-schema.mjs";
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 */

/**
 * @augments {VolumeData}
 */
export default class RawVolumeData extends VolumeData {
    static modelName = "rawVolumeData";
    static lockManager = new WriteLockManager(this.modelName);
    static mrcTempDirectory = path.join(appConfig.tempPath, "mrc");

    static get db() {
        return prismaManager.db.rawVolumeData;
    }

    static get folderPath() {
        return "raw-data";
    }

    /**
     * @param {number} id
     * @returns {Promise<RawVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @returns {Promise<RawVolumeDataDB>}
     */
    static async create(creatorId, volumeId) {
        return await super.create(creatorId, volumeId);
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {PendingUpload[]} files
     * @param {z.infer<typeof volumeSettings>} settings
     * @param {boolean?} skipLock
     * @returns {Promise<RawVolumeDataDB>}
     */
    static async createFromFiles(
        creatorId,
        volumeId,
        files,
        settings,
        skipLock = false
    ) {
        return await super.createFromFiles(
            creatorId,
            volumeId,
            files,
            settings,
            skipLock
        );
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {PendingUpload} file
     * @returns {Promise<object>}
     */
    static async createFromMrcFile(creatorId, volumeId, file) {
        return await Volume.withWriteLock(
            volumeId,
            [this.modelName],
            async () => {
                await fsPromises.mkdir(RawVolumeData.mrcTempDirectory, {
                    recursive: true,
                });
                const tempDirectory = await fsPromises.mkdtemp(
                    RawVolumeData.mrcTempDirectory
                );

                try {
                    /* Save to temporary directory and perform operations there 
                    so we don't clog up the database with long transaction. */
                    const mrcFilePathTemp = await file.saveAs(tempDirectory);
                    const { rawFileName, settings } = await Utils.mrcToRaw(
                        mrcFilePathTemp,
                        tempDirectory
                    );

                    return await prismaManager.db.$transaction(
                        async (tx) => {
                            /** @type {RawVolumeDataDB} */
                            const volumeData = await tx.rawVolumeData.create({
                                data: {
                                    creatorId: creatorId,
                                    volumeId,
                                    ...RawVolumeData.fromSettingSchema(
                                        settings
                                    ),
                                },
                            });
                            let folderPath = null;
                            try {
                                folderPath = await this.createVolumeDataFolder(
                                    volumeData.id
                                );
                                const mrcFilePath = path.join(
                                    folderPath,
                                    path.basename(mrcFilePathTemp)
                                );
                                await fsPromises.rename(
                                    mrcFilePathTemp,
                                    mrcFilePath
                                );
                                const rawFilePath = path.join(
                                    folderPath,
                                    rawFileName
                                );
                                await fsPromises.rename(
                                    path.join(tempDirectory, rawFileName),
                                    rawFilePath
                                );

                                return await tx.rawVolumeData.update({
                                    where: { id: volumeData.id },
                                    data: {
                                        path: folderPath,
                                        rawFilePath: rawFilePath,
                                        mrcFilePath: mrcFilePath,
                                    },
                                });
                            } catch (error) {
                                if (folderPath != null) {
                                    await fsPromises.rm(folderPath, {
                                        recursive: true,
                                        force: true,
                                    });
                                }
                                throw error;
                            }
                        },
                        {
                            timeout: 60000,
                        }
                    );
                } finally {
                    await fsPromises.rm(tempDirectory, {
                        recursive: true,
                        force: true,
                    });
                }
            }
        );
    }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.RawVolumeDataUpdateInput} changes
     * @returns {Promise<RawVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} id
     * @returns {Promise<RawVolumeDataDB>}
     */
    static async del(id) {
        return prismaManager.db.$transaction(
            async (tx) => {
                const rawVolumeData = await tx.rawVolumeData.delete({
                    where: { id: id },
                });
                await this.deleteVolumeDataFiles(rawVolumeData);
                return rawVolumeData;
            },
            {
                timeout: 60000,
            }
        );
    }

    /**
     * @param {RawVolumeDataDB} volumeData
     * @returns {string[]}
     */
    static getFilePaths(volumeData) {
        const files = super.getFilePaths(volumeData);
        if (volumeData.mrcFilePath) {
            files.push(volumeData.mrcFilePath);
        }
        return files;
    }

    static async deleteVolumeDataFiles(volumeData) {
        if (volumeData.mrcFilePath) {
            await fsPromises.rm(volumeData.mrcFilePath, {
                recursive: true,
                force: true,
            });
        }
        super.deleteVolumeDataFiles(volumeData);
    }

    /**
     * @param {number} id
     * @param {boolean} downloadRawFile
     * @param {boolean} downloadSettingsFile
     * @param {boolean} downloadMrcFile
     */
    static async prepareDataForDownload(
        id,
        downloadRawFile = true,
        downloadSettingsFile = true,
        downloadMrcFile = false
    ) {
        const volumeData = await this.getById(id);

        let hasFiles = false;

        const archive = archiver("zip", {
            zlib: { level: appConfig.compressionLevel },
        });

        if (downloadRawFile && volumeData.rawFilePath != null) {
            archive.file(volumeData.rawFilePath, {
                name: path.basename(volumeData.rawFilePath),
            });
            hasFiles = true;
        }
        if (downloadSettingsFile) {
            const settings = RawVolumeData.toSettingSchema(volumeData);
            const settingsJSON = JSON.stringify(settings, null, 4);
            archive.append(settingsJSON, {
                name: `${Utils.stripExtension(volumeData.rawFilePath)}.json`,
            });
            hasFiles = true;
        }
        if (downloadMrcFile && volumeData.mrcFilePath != null) {
            archive.file(volumeData.mrcFilePath, {
                name: path.basename(volumeData.mrcFilePath),
            });
            hasFiles = true;
        }

        if (!hasFiles) {
            throw new ApiError(404, "No files to download.");
        }

        const outputFileName = `${this.modelName}_${Utils.stripExtension(
            volumeData.path
        )}`;

        return {
            name: `${outputFileName}.zip`,
            archive: archive,
        };
    }
   
}
