// @ts-check

import AdmZip from "adm-zip";
import path from "path";
import { mrcToRaw } from "../tools/utils.mjs";
import { VolumeData } from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { BaseModel } from "./base-model.mjs";
import { rm } from "node:fs/promises";
import fileUpload from "express-fileupload";
import { unpackFiles } from "../tools/file-handler.mjs";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 */

/**
 * @extends {VolumeData}
 */
export class RawVolumeData extends VolumeData {
    /**
     * @return {String}
     */
    static get modelName() {
        return "rawVolumeData";
    }

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
        return /** @type {RawVolumeDataDB} */ (
            /** @type {unknown} */ (await super.getById(id))
        );
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<RawVolumeDataDB>}
     */
    static async create(ownerId, volumeId) {
        return /** @type {RawVolumeDataDB} */ (
            /** @type {unknown} */ (await super.create(ownerId, volumeId))
        );
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {Number} [ownerId]
     * @property {String?} [path]
     * @property {String?} [rawFilePath]
     * @property {String?} [settingsFilePath]
     * @property {String?} [mrcFilePath]
     * @param {Changes} changes
     * @return {Promise<RawVolumeDataDB>}
     */
    static async update(id, changes) {
        return /** @type {RawVolumeDataDB} */ (
            /** @type {unknown} */ (await super.update(id, changes))
        );
    }

    /**
     * @param {Number} id
     * @return {Promise<RawVolumeDataDB>}
     */
    static async del(id) {
        const volumeData = await BaseModel.del(id);
        this.deleteVolumeDataFiles(volumeData);
        return volumeData;
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
            await rm(mrcFilePath, { recursive: true, force: true });
        } catch (error) {
            console.error(
                `Failed to remove raw file ${mrcFilePath} from disk.\n${error.toString()}`
            );
        }
        return volumeData;
    }

    static async deleteVolumeDataFiles(volumeData) {
        if (volumeData.mrcFilePath) {
            await rm(volumeData.mrcFilePath, { recursive: true, force: true });
        }
        super.deleteVolumeDataFiles(volumeData);
    }

    /**
     * @param {Number} id
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<RawVolumeDataDB>}
     */
    static async uploadFiles(id, files) {
        return /** @type {RawVolumeDataDB} */ (
            /** @type {unknown} */ (await super.uploadFiles(id, files, true))
        );
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
            const { rawFileName, settings } = await mrcToRaw(
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
                    await rm(rawFileName, {
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
                await rm(mrcFilePath, {
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
}
