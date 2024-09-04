// @ts-check

import path from "path";
import fsPromises from "node:fs/promises";
import fileSystem from "fs";
import { BaseModel } from "./base-model.mjs";
import appConfig from "../tools/config.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import {
    generateUniqueFileName,
    isFileExtensionAccepted,
} from "../tools/utils.mjs";
import fileUpload from "express-fileupload";
import { unpackFiles } from "../tools/file-handler.mjs";
import AdmZip from "adm-zip";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoLabelVolumeDataDB
 * @typedef { RawVolumeDataDB | SparseLabelVolumeDataDB | PseudoLabelVolumeDataDB } VolumeDataDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 */

/**
 * @extends {BaseModel}
 */
export class VolumeData extends BaseModel {
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
     * @return {Promise<VolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<VolumeDataDB>}
     */
    static async create(ownerId, volumeId) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                const volumeData = await tx[this.modelName].create({
                    data: {
                        ownerId: ownerId,
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
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {Number} [ownerId]
     * @property {String?} [path]
     * @property {String?} [rawFilePath]
     * @property {String?} [settingsFilePath]
     * @param {Changes} changes
     * @return {Promise<VolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<VolumeDataDB>}
     */
    static async del(id) {
        const volumeData = await this.db.delete({
            where: { id: id },
        });
        await this.deleteVolumeDataFiles(volumeData);
        return volumeData;
    }

    /**
     * @param {Number} id
     * @param {Number} volumeId
     * @return {Promise<VolumeDataDB>}
     */
    static async removeFromVolume(id, volumeId) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                /** @type {VolumeDataDB & {volumes: VolumeDB[]}} */
                let volumeData = await tx[this.modelName].findUnique({
                    where: { id: id },
                    include: {
                        volumes: true,
                    },
                });

                if (!volumeData.volumes.some((m) => m.id === volumeId)) {
                    throw new Error("Volume Data is not part of the volume.");
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
                    await tx[this.modelName].delete({
                        where: { id: id },
                    });
                    await this.deleteVolumeDataFiles(volumeData);
                }
                return volumeData;
            },
            {
                timeout: 60000,
            }
        );
    }

    /**
     * @param {Number} id
     */
    static async removeRawFile(id) {
        let volumeData = await this.getById(id);
        const rawFilePath = volumeData.rawFilePath;
        if (!rawFilePath) {
            throw new Error("Volume Data has no associated raw file.");
        }
        volumeData = await this.db.update({
            where: { id: id },
            data: { rawFilePath: null },
        });
        try {
            await fsPromises.rm(rawFilePath, { recursive: true, force: true });
        } catch (error) {
            console.error(
                `Failed to remove raw file ${rawFilePath} from disk.\n${error.toString()}`
            );
        }
        return volumeData;
    }

    /**
     * @param {Number} id
     */
    static async createVolumeDataFolder(id) {
        const folderPath = path.join(
            appConfig.projects.volumeDataPath,
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
     * @param {Number} id
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<VolumeDataDB>}
     */
    static async uploadFiles(id, files, preventRawFileOverride = false) {
        const unpackedFiles = unpackFiles(files, this.acceptedFileExtensions);

        let newRawFile = null;
        let newSettingFile = null;

        for (const unpackedFile of unpackedFiles) {
            if (
                !newRawFile &&
                isFileExtensionAccepted(
                    unpackedFile.fileName,
                    this.rawFileExtensions
                )
            ) {
                newRawFile = unpackedFile;
            } else if (
                !newSettingFile &&
                isFileExtensionAccepted(
                    unpackedFile.fileName,
                    this.settingFileExtensions
                )
            ) {
                newSettingFile = unpackedFile;
            }
        }

        const { volumeData, oldRawFilePath } =
            await prismaManager.db.$transaction(
                async (tx) => {
                    /** @type {VolumeDataDB} */
                    let volumeData = await tx[this.modelName].findUnique({
                        where: { id: id },
                    });

                    if (
                        preventRawFileOverride &&
                        newRawFile &&
                        volumeData.rawFilePath
                    ) {
                        throw new Error(
                            "Once Raw File is uploaded to a Raw Volume Data it cannot be changed."
                        );
                    }

                    if (!newRawFile && !newSettingFile) {
                        throw new Error("No valid files provided");
                    }

                    if (!fileSystem.existsSync(volumeData.path)) {
                        fileSystem.mkdirSync(volumeData.path, {
                            recursive: true,
                        });
                    }

                    const changes = {};

                    let rawFileNameOverride = null;
                    if (newRawFile) {
                        rawFileNameOverride = this.checkFilePath(
                            volumeData.path,
                            newRawFile.filteredFileName
                        );
                    }

                    let oldRawFilePath = null;

                    try {
                        if (newRawFile) {
                            if (volumeData.rawFilePath) {
                                oldRawFilePath = volumeData.rawFilePath;
                            }
                            changes.rawFilePath = await newRawFile.saveAs(
                                volumeData.path,
                                rawFileNameOverride
                            );
                        }

                        if (newSettingFile) {
                            changes.settings = await this.parseSettings(
                                newSettingFile.data.toString("utf-8"),
                                newRawFile != null
                                    ? changes.rawFilePath
                                    : volumeData.rawFilePath
                            );
                        }

                        volumeData = await tx[this.modelName].update({
                            where: { id: volumeData.id },
                            data: changes,
                        });
                    } catch (error) {
                        try {
                            if (Object.hasOwn(changes, "rawFilePath")) {
                                await fsPromises.rm(changes.rawFilePath, {
                                    force: true,
                                });
                            }
                        } catch (error) {
                            console.error(
                                "Failed Volume Data Upload: Failed to delete the uploaded raw file."
                            );
                        }
                        throw error;
                    }
                    return {
                        volumeData: volumeData,
                        oldRawFilePath: oldRawFilePath,
                    };
                },
                {
                    timeout: 60000,
                }
            );

        if (oldRawFilePath) {
            try {
                await fsPromises.rm(oldRawFilePath, {
                    force: true,
                });
            } catch (error) {
                console.error(
                    "Volume Data Upload: Some old files failed to be deleted"
                );
            }
        }

        return volumeData;
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
            fileNameOverride = generateUniqueFileName(potentialSettingFilePath);
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
            zip.addFile(
                `${path.parse(volumeData.rawFilePath).name}.json`,
                Buffer.from(volumeData.settings)
            );
            hasFiles = true;
        }

        if (!hasFiles) {
            throw new Error("No files to download.");
        }

        const outputFileName = `${this.modelName}_${
            path.parse(volumeData.path).name
        }`;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer(),
        };
    }
}
