// @ts-check

import AdmZip from "adm-zip";
import path from "path";
import fileSystem from "fs";
import { mrcToRaw } from "../tools/utils.mjs";
import {
    VolumeData,
    RawVolumeFile,
    SettingsFile,
    StoredFile,
} from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { BaseModel } from "./base-model.mjs";
import { isFileExtensionAccepted } from "../tools/utils.mjs";

export class MrcVolumeFile extends StoredFile {
    static acceptedFileExtensions = [".mrc"];
    /**
     * @param {String} filePath
     */
    constructor(filePath) {
        super(filePath);
    }

    static isMrcVolumeFile(fileName) {
        return isFileExtensionAccepted(
            fileName,
            MrcVolumeFile.acceptedFileExtensions
        );
    }

    static async fromFile(file, uploadPath, moveFunction) {
        const storedFile = await super.fromFile(
            file,
            uploadPath,
            MrcVolumeFile.acceptedFileExtensions,
            moveFunction
        );
        return new MrcVolumeFile(storedFile.filePath);
    }
}

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

    static get getFolderPath() {
        return "raw-data";
    }

    /**
     * @param {Number} id
     * @param {Number} userId
     * @param {String} path
     * @param {RawVolumeFile} rawFile
     * @param {SettingsFile} settingsFile
     * @param {MrcVolumeFile} mrcFile
     */
    constructor(
        id,
        userId,
        path,
        rawFile = null,
        settingsFile = null,
        mrcFile = null
    ) {
        super(id, userId, path, rawFile, settingsFile);

        /** @type {MrcVolumeFile} */
        this.mrcFile = mrcFile;
    }

    /**
     * @param {Number} id
     * @return {Promise<RawVolumeData>}
     */
    static async getById(id) {
        return /** @type {RawVolumeData} */ (
            /** @type {unknown} */ (await super.getById(id))
        );
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<RawVolumeData>}
     */
    static async create(ownerId, volumeId) {
        return /** @type {RawVolumeData} */ (
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
     * @return {Promise<RawVolumeData>}
     */
    static async update(id, changes) {
        return /** @type {RawVolumeData} */ (
            /** @type {unknown} */ (await super.update(id, changes))
        );
    }

    /**
     * @param {Number} id
     * @return {Promise<RawVolumeData>}
     */
    static async del(id) {
        const volumeDataReference = await BaseModel.del(id);
        const volumeData = this.fromReference(volumeDataReference);
        volumeData.deleteVolumeDataFiles();
        return volumeData;
    }

    /**
     * @param {Number} id
     */
    static async removeMrcFile(id) {
        const volumeData = await this.getById(id);
        await volumeData.deleteMrcFile();
        await this.db.update({
            where: { id: id },
            data: { mrcFilePath: null },
        });
        return volumeData;
    }

    async deleteVolumeDataFiles() {
        if (this.mrcFile) {
            this.mrcFile.delete();
        }
        super.deleteVolumeDataFiles();
    }

    /**
     * @typedef {Object} dbReferenceObj
     * @property {Number} id
     * @property {Number} ownerId
     * @property {String?} path
     * @property {String?} rawFilePath
     * @property {String?} settingsFilePath
     * @property {String?} mrcFilePath
     * @param {dbReferenceObj} dbReference
     * @returns {RawVolumeData}
     */
    static fromReference(dbReference) {
        let rawFile = null;
        if (dbReference.rawFilePath) {
            rawFile = new RawVolumeFile(dbReference.rawFilePath);
        }
        let settingsFile = null;
        if (dbReference.settingsFilePath) {
            settingsFile = new SettingsFile(dbReference.settingsFilePath);
        }
        let mrcFile = null;
        if (dbReference.settingsFilePath) {
            mrcFile = new MrcVolumeFile(dbReference.mrcFilePath);
        }
        return new this(
            dbReference.id,
            dbReference.ownerId,
            dbReference.path,
            rawFile,
            settingsFile,
            mrcFile
        );
    }

    async uploadMrcFile(file) {
        if (!fileSystem.existsSync(this.path)) {
            fileSystem.mkdirSync(this.path, { recursive: true });
        }

        let uploadSuccessful = false;

        if (Array.isArray(file)) {
            throw new Error(
                "When adding MRC data, only a single file can be selected."
            );
        } else if (file.name.endsWith(".zip")) {
            let zip = new AdmZip(file.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (MrcVolumeFile.isMrcVolumeFile(entry.name)) {
                    if (this.mrcFile) {
                        await this.deleteMrcFile();
                    }
                    this.mrcFile = await MrcVolumeFile.fromFile(
                        file,
                        this.path,
                        (file, filteredFileName, fullPath) =>
                            zip.extractEntryTo(
                                entry,
                                this.path,
                                false,
                                true,
                                false,
                                filteredFileName
                            )
                    );
                    uploadSuccessful = true;
                    break;
                }
            }
        } else if (MrcVolumeFile.isMrcVolumeFile(file.name)) {
            if (this.mrcFile) {
                await this.deleteMrcFile();
            }
            this.mrcFile = await MrcVolumeFile.fromFile(
                file,
                this.path,
                (file, filteredFileName, fullPath) => file.mv(fullPath)
            );
            uploadSuccessful = true;
        }

        if (!uploadSuccessful) {
            throw new Error("No valid MRC file found.");
        }

        if (this.rawFile) {
            await this.deleteRawFile();
        }
        if (this.settingsFile) {
            await this.deleteSettingsFile();
        }

        const { rawFilePath, settingsFilePath } = await mrcToRaw(
            this.mrcFile.filePath,
            this.path
        );
        this.rawFile = new RawVolumeFile(rawFilePath);
        this.settingsFile = new SettingsFile(settingsFilePath);

        const changes = {
            rawFilePath: this.rawFile.filePath,
            settingsFilePath: this.settingsFile.filePath,
            mrcFilePath: this.mrcFile.filePath,
        };

        await Object.getPrototypeOf(this).constructor.update(this.id, changes);
    }

    prepareDataForDownload(
        downloadRawFile = true,
        downloadSettingsFile = true,
        downloadMrcFile = true
    ) {
        let hasFiles = false;

        const zip = new AdmZip();
        if (downloadRawFile && this.rawFile != null) {
            zip.addLocalFile(this.rawFile.filePath);
            hasFiles = true;
        }
        if (downloadSettingsFile && this.settingsFile != null) {
            zip.addLocalFile(this.settingsFile.filePath);
            hasFiles = true;
        }
        if (downloadMrcFile && this.mrcFile != null) {
            zip.addLocalFile(this.mrcFile.filePath);
            hasFiles = true;
        }

        if (!hasFiles) {
            throw new Error("No files to download.");
        }

        const outputFileName = path.parse(this.path).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer(),
        };
    }

    async deleteMrcFile() {
        if (this.mrcFile == null) {
            throw new Error("Raw volume does not have a mrc file");
        }
        await this.mrcFile.delete();
        this.mrcFile = null;
    }
}
