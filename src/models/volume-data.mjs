// @ts-check

import path from "path";
import fsPromises from "node:fs/promises";
import fileSystem from "fs";
import DatabaseModel from "./database-model.mjs";
import appConfig from "../tools/config.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import Utils from "../tools/utils.mjs";
import fileUpload from "express-fileupload";
import { unpackFiles } from "../tools/file-handler.mjs";
import AdmZip from "adm-zip";
import Volume from "./volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoLabelVolumeDataDB
 * @typedef { RawVolumeDataDB | SparseLabelVolumeDataDB | PseudoLabelVolumeDataDB } VolumeDataDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 *
 * @typedef {Object} VolumeDataSettings
 * @property {String} file
 * @property {{x: Number, y: Number, z:Number}} size
 * @property {{x: Number, y: Number, z:Number}} ratio
 * @property {Number} bytesPerVoxel
 * @property {Number} usedBits
 * @property {Number} skipBytes
 * @property {Boolean} isLittleEndian
 * @property {Boolean} isSigned
 * @property {Number} addValue
 * @property {String?} transferFunction
 * @property {String?} name
 */

/**
 * @extends {DatabaseModel}
 */
export default class VolumeData extends DatabaseModel {
    static volumeDataFolder = "volume-data";
    static rawFileExtensions = [".raw"];
    static settingFileExtensions = [".json"];
    static acceptedFileExtensions = this.rawFileExtensions.concat(
        this.settingFileExtensions
    );

    /**
     * @return {String}
     */
    static get folderPath() {
        throw new Error("Method not implemented");
    }

    /**
     * @param {Number} id
     * @return {Promise<Object>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} creatorId
     * @param {Number} volumeId
     * @return {Promise<Object>}
     */
    static async create(creatorId, volumeId) {
        return Volume.withWriteLock(volumeId, [this.modelName], () => {
            return prismaManager.db.$transaction(
                async (tx) => {
                    /** @type {VolumeDataDB} */
                    const volumeData = await tx[this.modelName].create({
                        data: {
                            creatorId: creatorId,
                            volumes: {
                                connect: { id: volumeId },
                            },
                        },
                    });

                    const folderPath = await this.createVolumeDataFolder(
                        volumeData.id
                    );

                    try {
                        await tx[this.modelName].update({
                            where: { id: volumeData.id },
                            data: { path: folderPath },
                        });
                    } catch (error) {
                        await this.deleteVolumeDataFiles(volumeData);
                        throw error;
                    }
                    return volumeData;
                },
                {
                    timeout: 60000,
                }
            );
        });
    }

    /**
     * @param {Number} creatorId
     * @param {Number} volumeId
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<Object>}
     */
    static async createFromFiles(creatorId, volumeId, files) {
        return await Volume.withWriteLock(
            volumeId,
            [this.modelName],
            async () => {
                const unpackedFiles = await unpackFiles(
                    files,
                    this.acceptedFileExtensions
                );

                let rawFile = null;
                let settingsFile = null;

                for (const unpackedFile of unpackedFiles) {
                    if (
                        !rawFile &&
                        Utils.isFileExtensionAccepted(
                            unpackedFile.fileName,
                            this.rawFileExtensions
                        )
                    ) {
                        rawFile = unpackedFile;
                    } else if (
                        !settingsFile &&
                        Utils.isFileExtensionAccepted(
                            unpackedFile.fileName,
                            this.settingFileExtensions
                        )
                    ) {
                        settingsFile = unpackedFile;
                    }
                }

                if (!rawFile || !settingsFile) {
                    throw new ApiError(
                        400,
                        "Volume data requires both a .raw file and a settings file to create."
                    );
                }

                return await prismaManager.db.$transaction(
                    async (tx) => {
                        /** @type {VolumeDataDB} */
                        let volumeData = await tx[this.modelName].create({
                            data: {
                                creatorId: creatorId,
                                volumes: {
                                    connect: { id: volumeId },
                                },
                            },
                        });
                        let folderPath = null;
                        try {
                            folderPath = await this.createVolumeDataFolder(
                                volumeData.id
                            );
                            const rawFilePath = await rawFile.saveAs(
                                folderPath
                            );
                            const settingFileContents =
                                await settingsFile.getData();
                            const settings = await this.parseSettings(
                                settingFileContents.toString("utf-8"),
                                rawFilePath
                            );

                            volumeData = await tx[this.modelName].update({
                                where: { id: volumeData.id },
                                data: {
                                    path: folderPath,
                                    rawFilePath: rawFilePath,
                                    settings: settings,
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
                        return volumeData;
                    },
                    {
                        timeout: 60000,
                    }
                );
            }
        );
    }

    /**
     * @param {Number} id
     * @param {any} changes
     * @return {Promise<Object>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<Object>}
     */
    static async del(id) {
        return this.withWriteLock(id, null, async () => {
            const volumeData = await this.db.delete({
                where: { id: id },
            });
            await this.deleteVolumeDataFiles(volumeData);

            return volumeData;
        });
    }

    /**
     * @param {Number} id
     * @param {Number} volumeId
     * @return {Promise<Object>}
     */
    static async removeFromVolume(id, volumeId) {
        return Volume.withWriteLock(volumeId, [this.modelName], () => {
            return prismaManager.db.$transaction(
                async (tx) => {
                    /** @type {VolumeDataDB & {volumes: VolumeDB[]}} */
                    let volumeData = await tx[this.modelName].findUnique({
                        where: { id: id },
                        include: {
                            volumes: true,
                        },
                    });

                    if (!volumeData.volumes.some((m) => m.id === volumeId)) {
                        throw new ApiError(
                            400,
                            "Volume Data is not part of the volume."
                        );
                    }

                    if (volumeData.volumes.length > 1) {
                        await tx[this.modelName].update({
                            where: {
                                id: id,
                            },
                            data: {
                                volumes: {
                                    disconnect: { id: volumeId },
                                },
                            },
                        });
                    } else {
                        this.withWriteLock(id, null, () => {
                            return tx[this.modelName].delete({
                                where: { id: id },
                            });
                        });
                        await this.deleteVolumeDataFiles(volumeData);
                    }
                    return volumeData;
                },
                {
                    timeout: 60000,
                }
            );
        });
    }

    /**
     * @param {Number} id
     */
    static async createVolumeDataFolder(id) {
        const folderPath = path.join(
            appConfig.dataPath,
            this.volumeDataFolder,
            this.folderPath,
            id.toString()
        );
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new Error(`Volume directory already exists`);
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
     * @param {VolumeDataDB} volumeData
     * @returns {String[]}
     */
    static getFilePaths(volumeData) {
        const files = [];
        if (volumeData.rawFilePath) {
            files.push(volumeData.rawFilePath);
        }
        if (volumeData.path) {
            files.push(volumeData.path);
        }
        return files;
    }

    /**
     * @param {VolumeDataDB} volumeData
     */
    static async deleteVolumeDataFiles(volumeData) {
        if (volumeData.rawFilePath) {
            await fsPromises.rm(volumeData.rawFilePath, {
                recursive: true,
                force: true,
            });
        }
        if (volumeData.path) {
            await fsPromises.rm(volumeData.path, {
                recursive: true,
                force: true,
            });
        }
    }

    /**
     * @param {String} settingsString
     * @param {String?} rawFilePath
     */
    static async parseSettings(settingsString, rawFilePath = null) {
        const settings = JSON.parse(settingsString);
        if (rawFilePath) {
            settings["file"] = path.basename(rawFilePath);
        }
        if (!Object.hasOwn(settings, "transferFunction")) {
            settings["transferFunction"] = "tf-default.json";
        }
        return JSON.stringify(settings);
    }

    /**
     * @param {String} folderPath
     * @param {String} fileName
     */
    static checkFilePath(folderPath, fileName) {
        let fileNameOverride = null;
        const potentialSettingFilePath = path.join(folderPath, fileName);
        if (fileSystem.existsSync(potentialSettingFilePath)) {
            fileNameOverride = Utils.generateUniqueFileName(
                potentialSettingFilePath
            );
        }
        return fileNameOverride;
    }

    /**
     * @param {Number} id
     */
    static async prepareDataForDownload(
        id,
        downloadRawFile = true,
        downloadSettingsFile = true
    ) {
        const volumeData = await this.getById(id);

        let hasFiles = false;

        const zip = new AdmZip();
        if (downloadRawFile && volumeData.rawFilePath != null) {
            zip.addLocalFile(volumeData.rawFilePath);
            hasFiles = true;
        }
        if (downloadSettingsFile && volumeData.settings != null) {
            const settings = JSON.parse(volumeData.settings);
            const settingsJSON = JSON.stringify(settings, null, 4);
            zip.addFile(
                `${Utils.stripExtension(volumeData.rawFilePath)}.json`,
                Buffer.from(settingsJSON)
            );
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
            zipBuffer: zip.toBuffer(),
        };
    }
}
