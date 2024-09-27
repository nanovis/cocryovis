// @ts-check

import AdmZip from "adm-zip";
import path from "path";
import Utils from "../tools/utils.mjs";
import VolumeData from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "node:fs/promises";
import fileUpload from "express-fileupload";
import { unpackFiles } from "../tools/file-handler.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 */

/**
 * @extends {VolumeData}
 */
export default class RawVolumeData extends VolumeData {
    static modelName = "rawVolumeData";
    static lockManager = new WriteLockManager(this.modelName);

    static get db() {
        return prismaManager.db.rawVolumeData;
    }

    static get folderPath() {
        return "raw-data";
    }

    /**
     * @param {Number} id
     * @return {Promise<RawVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<RawVolumeDataDB>}
     */
    static async create(ownerId, volumeId) {
        return await super.create(ownerId, volumeId);
    }

    /**
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.RawVolumeDataUpdateInput} changes
     * @return {Promise<RawVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @param {Number} volumeId
     * @return {Promise<RawVolumeDataDB>}
     */
    static async removeFromVolume(id, volumeId) {
        return Volume.withWriteLock(volumeId, [this.modelName], () => {
            return prismaManager.db.$transaction(
                async (tx) => {
                    let volumeData = await tx.rawVolumeData.findUnique({
                        where: { id: id },
                        include: {
                            volumes: true,
                            results: true,
                        },
                    });

                    if (!volumeData.volumes.some((m) => m.id === volumeId)) {
                        throw new Error("Volume Data is not part of the volume.");
                    }

                    if (
                        volumeData.volumes.length > 1 ||
                        volumeData.results.length > 0
                    ) {
                        await tx.rawVolumeData.update({
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
                        await tx.rawVolumeData.delete({
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
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<RawVolumeDataDB>}
     */
    static async removeMrcFile(id) {
        let volumeData = await this.getById(id);
        const mrcFilePath = volumeData.mrcFilePath;
        if (!mrcFilePath) {
            throw new Error("Volume Data has no associated mrc file.");
        }
        volumeData = await this.db.update({
            where: { id: id },
            data: { mrcFilePath: null },
        });
        try {
            await fsPromises.rm(mrcFilePath, { recursive: true, force: true });
        } catch (error) {
            console.error(
                `Failed to remove raw file ${mrcFilePath} from disk.\n${error.toString()}`
            );
        }
        return volumeData;
    }

    /**
     * @param {RawVolumeDataDB} volumeData
     * @returns {String[]}
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
     * @param {Number} id
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<RawVolumeDataDB>}
     */
    static async uploadFiles(id, files) {
        return await super.uploadFiles(id, files, true);
    }

    /**
     * @param {Number} id
     * @param {fileUpload.UploadedFile} file
     * @return {Promise<RawVolumeDataDB>}
     */
    static async uploadMrcFile(id, file) {
        const unpackedFiles = unpackFiles([file], [".mrc"]);
        if (unpackedFiles.length == 0) {
            throw new Error("No valid MRC file found.");
        }

        let volumeData = await this.getById(id);

        if (volumeData.mrcFilePath) {
            throw new Error(
                "Once a MRC File is uploaded to a Raw Volume Data it cannot be changed."
            );
        }

        if (volumeData.rawFilePath) {
            throw new Error(
                "Once a Raw File is uploaded to a Raw Volume Data a MRC file can no longer be added."
            );
        }

        const mrcFilePath = await unpackedFiles[0].saveAs(volumeData.path);

        try {
            const { rawFileName, settings } = await Utils.mrcToRaw(
                mrcFilePath,
                volumeData.path
            );

            try {
                const changes = {
                    rawFilePath: path.join(volumeData.path, rawFileName),
                    settings: JSON.stringify(settings),
                    mrcFilePath: mrcFilePath,
                };
                volumeData = await this.update(id, changes);
            } catch (error) {
                try {
                    await fsPromises.rm(rawFileName, {
                        force: true,
                    });
                } catch (error) {
                    console.error(
                        "Failed Volume Data Upload: Failed to delete the converted raw data file."
                    );
                }
                throw error;
            }
        } catch (error) {
            try {
                await fsPromises.rm(mrcFilePath, {
                    force: true,
                });
            } catch (error) {
                console.error(
                    "Failed Volume Data Upload: Failed to delete the uploaded MRC file."
                );
            }

            throw error;
        }

        return volumeData;
    }

    /**
     * @param {Number} id
     */
    static async prepareDataForDownload(
        id,
        downloadRawFile = true,
        downloadSettingsFile = true,
        downloadMrcFile = true
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
                `${path.parse(volumeData.rawFilePath).name}.json`,
                Buffer.from(settingsJSON)
            );
            hasFiles = true;
        }
        if (downloadMrcFile && volumeData.mrcFilePath != null) {
            zip.addLocalFile(volumeData.mrcFilePath);
            hasFiles = true;
        }

        if (!hasFiles) {
            throw new Error("No files to download.");
        }

        let outputFileName = `${this.modelName}_${
            path.parse(volumeData.path).name
        }`;

        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer(),
        };
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

        const rawVolumes = await tx.rawVolumeData.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    volumes: {
                        none: {},
                    },
                    results: {
                        none: {},
                    },
                },
            },
        });

        const idsToDelete = rawVolumes.map((v) => v.id);

        return this.withWriteLocks(idsToDelete, null, async () => {
            await tx.rawVolumeData.deleteMany({
                where: {
                    id: {
                        in: rawVolumes.map((v) => v.id),
                    },
                },
            });

            /** @type {String[]} */
            const fileDeleteStack = [];

            rawVolumes.forEach((v) =>
                fileDeleteStack.push(...RawVolumeData.getFilePaths(v))
            );

            return fileDeleteStack;
        });
    }
}
