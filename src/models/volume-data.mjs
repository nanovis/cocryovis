// @ts-check

import path from "path";
import fsPromises from "node:fs/promises";
import fileSystem from "fs";
import DatabaseModel from "./database-model.mjs";
import appConfig from "../tools/config.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import Utils from "../tools/utils.mjs";
import { PendingUpload } from "../tools/file-handler.mjs";
import Volume from "./volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import archiver from "archiver";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoLabelVolumeDataDB
 * @typedef { RawVolumeDataDB | SparseLabelVolumeDataDB | PseudoLabelVolumeDataDB } VolumeDataDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef {object} VolumeDataSettings
 * @property {string} file
 * @property {{x: number, y: number, z: number}} size
 * @property {{x: number, y: number, z: number}} ratio
 * @property {number} bytesPerVoxel
 * @property {number} usedBits
 * @property {number} skipBytes
 * @property {boolean} isLittleEndian
 * @property {boolean} isSigned
 * @property {number} addValue
 * @property {string?} transferFunction
 * @property {string?} name
 */

/**
 * @augments {DatabaseModel}
 */
export default class VolumeData extends DatabaseModel {
    static volumeDataFolder = "volume-data";
    static rawFileExtensions = [".raw"];
    static settingFileExtensions = [".json"];
    static acceptedFileExtensions = this.rawFileExtensions.concat(
        this.settingFileExtensions
    );

    /**
     * @returns {string}
     */
    static get folderPath() {
        throw new Error("Method not implemented");
    }

    /**
     * @param {number} id
     * @returns {Promise<object>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number} volumeDataId
     * @param {number} volumeId
     * @returns {Promise<boolean>}
     */
    static async belongsToVolume(volumeDataId, volumeId) {
        const volumeData = await this.db.findUnique({
            where: { id: volumeDataId },
            include: {
                volumes: true,
            },
        });
        if (!volumeData || !volumeData.volumes.some((v) => v.id === volumeId)) {
            return false;
        }
        return true;
    }

    /**
     * @param {number} id
     * @returns {Promise<VolumeDB[]>}
     */
    static async getVolumes(id) {
        const volumeData = await this.db.findUnique({
            where: { id: id },
            include: {
                volumes: true,
            },
        });
        return volumeData?.volumes;
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @returns {Promise<object>}
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
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {PendingUpload[]} files
     * @param {boolean?} skipLock
     * @returns {Promise<object>}
     */
    static async createFromFiles(creatorId, volumeId, files, skipLock = false) {
        return await Volume.withWriteLock(
            volumeId,
            [this.modelName],
            async () => {
                let rawFile = null;
                let settingsFile = null;

                for (const unpackedFile of files) {
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
                            const rawFilePath =
                                await rawFile.saveAs(folderPath);
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
            },
            skipLock
        );
    }

    /**
     * @param {number} id
     * @param {any} changes
     * @returns {Promise<object>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} id
     * @returns {Promise<object>}
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
     * @param {number} id
     * @param {number} volumeId
     * @returns {Promise<object>}
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
     * @param {number} id
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
     * @returns {string[]}
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
     * @param {string} settingsString
     * @param {string?} rawFilePath
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
     * @param {string} folderPath
     * @param {string} fileName
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
     * @param {number} id
     * @param {boolean} downloadRawFile
     * @param {boolean} downloadSettingsFile
     */
    static async prepareDataForDownload(
        id,
        downloadRawFile = true,
        downloadSettingsFile = true
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
        if (downloadSettingsFile && volumeData.settings != null) {
            const settings = JSON.parse(volumeData.settings);
            delete settings.transferFunction;
            const settingsJSON = JSON.stringify(settings, null, 4);
            archive.append(settingsJSON, {
                name: `${Utils.stripExtension(volumeData.rawFilePath)}.json`,
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

    /**
     * @param {number} id
     * @param {PendingUpload} file
     * @returns {Promise<VolumeDataDB>}
     */
    static async setRawData(id, file) {
        return prismaManager.db.$transaction(
            async (tx) => {
                /** @type {VolumeDataDB} */
                const volumeData = await this.getById(id);

                const rawFilePath = volumeData.rawFilePath;
                let fileNameOverride = file.fileName;
                if (fileNameOverride === path.basename(rawFilePath)) {
                    const parsedName = path.parse(file.fileName);
                    fileNameOverride =
                        parsedName.name + "-new" + parsedName.ext;
                }
                try {
                    const newRawFilePath = await file.saveAs(
                        volumeData.path,
                        fileNameOverride
                    );
                    const settings = await this.parseSettings(
                        volumeData.settings,
                        newRawFilePath
                    );
                    return await tx[this.modelName].update({
                        where: { id: volumeData.id },
                        data: {
                            rawFilePath: newRawFilePath,
                            settings: settings,
                        },
                    });
                } catch (error) {
                    fsPromises.rm(
                        path.join(volumeData.path, fileNameOverride),
                        {
                            recursive: true,
                            force: true,
                        }
                    );
                    throw error;
                }
            },
            {
                timeout: 60000,
            }
        );
    }
}
