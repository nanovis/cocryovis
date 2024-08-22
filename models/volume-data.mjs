// @ts-check

import AdmZip from "adm-zip";
import path from "path";
import {
    rm,
    access,
    mkdir,
    readFile,
    writeFile,
    rename,
} from "node:fs/promises";
import fileSystem from "fs";
import { BaseModel } from "./base-model.mjs";
import appConfig from "../tools/config.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import {
    fileNameFilter,
    generateUniqueFileName,
    isFileExtensionAccepted,
} from "../tools/utils.mjs";
import fileUpload from "express-fileupload";
import { unpackFiles } from "../tools/file-handler.mjs";

export class StoredFile {
    /**
     * @param {String} filePath
     */
    constructor(filePath) {
        /** @type {String} */
        this.filePath = filePath;
    }

    static async fromFile(
        file,
        uploadPath,
        acceptedFileExtensions,
        moveFunction
    ) {
        if (isFileExtensionAccepted(file.name, acceptedFileExtensions)) {
            const filteredFileName = fileNameFilter(file.name);
            const fullPath = path.join(uploadPath, filteredFileName);
            await moveFunction(file, filteredFileName, fullPath);
            return new StoredFile(fullPath);
        }
        throw new Error("Incorrect file extension");
    }

    async delete() {
        await rm(this.filePath, { recursive: true, force: true });
    }

    get fileName() {
        if (!this.filePath) {
            return null;
        }
        return path.basename(this.filePath);
    }

    get fileExtension() {
        if (!this.filePath) {
            return null;
        }
        return path.extname(this.filePath);
    }

    prepareDataForDownload() {
        const zip = new AdmZip();
        zip.addLocalFile(this.filePath);
        const outputFileName = path.parse(this.filePath).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer(),
        };
    }
}

export class RawVolumeFile extends StoredFile {
    static acceptedFileExtensions = [".raw"];

    /**
     * @param {String} filePath
     */
    constructor(filePath) {
        super(filePath);
    }

    static isRawVolumeFile(fileName) {
        return isFileExtensionAccepted(
            fileName,
            RawVolumeFile.acceptedFileExtensions
        );
    }

    static async fromFile(file, uploadPath, moveFunction) {
        const storedFile = await super.fromFile(
            file,
            uploadPath,
            RawVolumeFile.acceptedFileExtensions,
            moveFunction
        );
        return new RawVolumeFile(storedFile.filePath);
    }
}

export class SettingsFile extends StoredFile {
    static acceptedFileExtensions = [".json"];

    /**
     * @param {String} filePath
     */
    constructor(filePath) {
        super(filePath);
    }

    static isSettingsFile(fileName) {
        return isFileExtensionAccepted(
            fileName,
            SettingsFile.acceptedFileExtensions
        );
    }

    static async fromFile(file, uploadPath, moveFunction) {
        const storedFile = await super.fromFile(
            file,
            uploadPath,
            SettingsFile.acceptedFileExtensions,
            moveFunction
        );
        return new SettingsFile(storedFile.filePath);
    }

    async readFile() {
        const contents = await readFile(this.filePath, { encoding: "utf8" });
        return JSON.parse(contents);
    }

    async setRawFilePath(rawFilePath) {
        try {
            const settings = await this.readFile();
            settings["file"] = rawFilePath;
            if (!Object.hasOwn(settings, "transferFunction")) {
                settings["transferFunction"] = "tf-default.json";
            }
            await writeFile(this.filePath, JSON.stringify(settings, null, 2));
        } catch (err) {
            console.error(err.message);
        }
    }
}

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
     * @param {Number} ownerId
     * @param {String} path
     * @param {RawVolumeFile} rawFile
     * @param {SettingsFile} settingsFile
     */
    constructor(id, ownerId, path, rawFile = null, settingsFile = null) {
        super();

        /** @type {Number} */
        this.id = id;
        /** @type {Number} */
        this.ownerId = ownerId;
        /** @type {String} */
        this.path = path;
        /** @type {RawVolumeFile} */
        this.rawFile = rawFile;
        /** @type {SettingsFile} */
        this.settingsFile = settingsFile;
    }

    /**
     * @param {Number} id
     * @return {Promise<VolumeData>}
     */
    static async getById(id) {
        const volumeDataReference = await super.getById(id);
        return this.fromReference(volumeDataReference);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<VolumeData>}
     */
    static async create(ownerId, volumeId) {
        return await prismaManager.db.$transaction(async (tx) => {
            const volumeDataReference = await tx[this.modelName].create({
                data: {
                    ownerId: ownerId,
                    volumes: {
                        connect: { id: volumeId },
                    },
                },
            });

            const volumeData = this.fromReference(volumeDataReference);
            await volumeData.createVolumeDataFolder();

            try {
                await tx[this.modelName].update({
                    where: { id: volumeData.id },
                    data: { path: volumeData.path },
                });
            } catch (error) {
                await volumeData.deleteVolumeDataFiles();
                throw error;
            }
            return volumeData;
        });
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {Number} [ownerId]
     * @property {String?} [path]
     * @property {String?} [rawFilePath]
     * @property {String?} [settingsFilePath]
     * @param {Changes} changes
     * @return {Promise<VolumeData>}
     */
    static async update(id, changes) {
        const volumeDataReference = await super.update(id, changes);
        return this.fromReference(volumeDataReference);
    }

    /**
     * @param {Number} id
     * @return {Promise<VolumeData>}
     */
    static async del(id) {
        const volumeDataReference = await super.del(id);
        const volumeData = this.fromReference(volumeDataReference);
        volumeData.deleteVolumeDataFiles();
        return volumeData;
    }

    /**
     * @param {Number} id
     */
    static async removeRawFile(id) {
        const volumeData = await this.getById(id);
        await volumeData.deleteRawFile();
        await this.db.update({
            where: { id: id },
            data: { rawFilePath: null },
        });
        return volumeData;
    }

    /**
     * @param {Number} id
     */
    static async removeSettingsFile(id) {
        const volumeData = await this.getById(id);
        await volumeData.deleteSettingsFile();
        await this.db.update({
            where: { id: id },
            data: { settingsFilePath: null },
        });
        return volumeData;
    }

    /**
     * @typedef {Object} dbReferenceObj
     * @property {Number} id
     * @property {Number} ownerId
     * @property {String} path
     * @property {String?} rawFilePath
     * @property {String?} settingsFilePath
     * @param {dbReferenceObj} dbReference
     * @returns {VolumeData}
     */
    static fromReference(dbReference) {
        let rawFile = null;
        if (dbReference.rawFilePath) {
            rawFile = new RawVolumeFile(dbReference.rawFilePath);
        }
        let settingsFile = null;
        if (dbReference.settingsFilePath) {
            rawFile = new SettingsFile(dbReference.settingsFilePath);
        }
        return new this(
            dbReference.id,
            dbReference.ownerId,
            dbReference.path,
            rawFile,
            settingsFile
        );
    }

    async createVolumeDataFolder() {
        const folderPath = path.join(
            appConfig.projects.volumeDataPath,
            Object.getPrototypeOf(this).constructor.folderPath,
            this.id.toString()
        );
        if (fileSystem.existsSync(folderPath)) {
            if (appConfig.safeMode) {
                throw new Error(`Volume directory already exists`);
            } else {
                await rm(folderPath, { recursive: true, force: true });
            }
        }
        fileSystem.mkdirSync(folderPath, { recursive: true });
        this.path = folderPath;
    }

    async deleteVolumeDataFiles() {
        if (this.rawFile) {
            this.rawFile.delete();
        }
        if (this.settingsFile) {
            this.settingsFile.delete();
        }
        await rm(this.path, { recursive: true, force: true });
    }

    isMissingFiles() {
        return this.rawFile == null || this.settingsFile == null;
    }

    /**
     * @param {Number} id
     * @param {fileUpload.UploadedFile[]} files
     */
    static async uploadFiles(id, files) {
        const unpackedFiles = unpackFiles(files, this.acceptedFileExtensions);

        const {volumeData, oldRawFilePath, oldSettingsFilePath} = await prismaManager.db.$transaction(
            async (tx) => {
                let volumeData = await tx[this.modelName].findUnique({
                    where: { id: id },
                });

                let newRawFile = null;
                let newSettingFile = null;

                let rawFileNameOverride = null;
                let settingsFileNameOverride = null;

                for (const unpackedFile of unpackedFiles) {
                    if (
                        !newRawFile &&
                        isFileExtensionAccepted(
                            unpackedFile.fileName,
                            this.rawFileExtensions
                        )
                    ) {
                        newRawFile = unpackedFile;
                        rawFileNameOverride = this.checkFilePath(volumeData.path, newRawFile.filteredFileName);
                    } else if (
                        !newSettingFile &&
                        isFileExtensionAccepted(
                            unpackedFile.fileName,
                            this.settingFileExtensions
                        )
                    ) {
                        newSettingFile = unpackedFile;
                        settingsFileNameOverride = this.checkFilePath(volumeData.path, newSettingFile.filteredFileName);
                    }
                }

                // if (newRawFile && volumeData.rawFilePath) {
                //     throw new Error("Once Raw File is uploaded to a Raw Volume Data it cannot be changed.");
                // }

                if (!newRawFile && !newSettingFile) {
                    throw new Error("No valid files provided");
                }

                if (!fileSystem.existsSync(volumeData.path)) {
                    fileSystem.mkdirSync(volumeData.path, { recursive: true });
                }

                const changes = {};

                let oldRawFilePath = null;
                let oldSettingsFilePath = null;
                let correctedOldSettingsFile = false;

                try {
                    if (newRawFile) {
                        if (volumeData.rawFilePath) {
                            oldRawFilePath = volumeData.rawFilePath;
                        }
                        changes.rawFilePath = await newRawFile.saveAs(
                            volumeData.path,
                            rawFileNameOverride
                        );
                    } else if (newSettingFile) {
                        if (volumeData.settingsFilePath) {
                            oldSettingsFilePath = volumeData.settingsFilePath;
                        }
                        changes.settingsFilePath = await newSettingFile.saveAs(
                            volumeData.path,
                            settingsFileNameOverride
                        );
                    }
    
                    if (newRawFile || volumeData.rawFilePath && newSettingFile || volumeData.settingsFilePath) {
                        let rawFilePath = newRawFile != null ? changes.rawFilePath : volumeData.rawFilePath;
                        let settingsFilePath = newSettingFile != null ? changes.settingsFilePath : volumeData.settingsFilePath;
                        
                        await this.correctRawFilePathInSettings(
                            settingsFilePath,
                            path.basename(rawFilePath)
                        );
                        if (!newSettingFile) {
                            correctedOldSettingsFile = true;
                        }
                    }

                    volumeData = await tx[this.modelName].update({
                        where: { id: volumeData.id },
                        data: changes,
                    });
                } catch (error) {
                    try {
                        if (Object.hasOwn(changes, "rawFilePath")) {
                            await rm(changes.rawFilePath, {
                                force: true,
                            });
                        }
                    }
                    catch(error) {
                        console.error("Failed Volume Data Upload: Some files failed to be deleted.");
                    }
                    try {
                        if (Object.hasOwn(changes, "settingsFilePath")) {
                            await rm(changes.settingsFilePath, {
                                force: true,
                            });
                        }
                    }
                    catch(error) {
                        console.error("Failed Volume Data Upload: Some files failed to be deleted.");
                    }

                    if (correctedOldSettingsFile && volumeData.rawFilePath) {
                        await this.correctRawFilePathInSettings(
                            volumeData.settingsFilePath,
                            path.basename(volumeData.rawFilePath)
                        );
                    }
                    throw error;
                }
                return {volumeData: volumeData, oldRawFilePath: oldRawFilePath, oldSettingsFilePath: oldSettingsFilePath};
            },
            {
                timeout: 60000,
            }
        );

        if (oldRawFilePath) {
            try {
                await rm(oldRawFilePath, {
                    force: true,
                });
            }
            catch(error) {
                console.error("Volume Data Upload: Some old files failed to be deleted");
            }
        }
        if (oldSettingsFilePath) {
            try {
                await rm(oldSettingsFilePath, {
                    force: true,
                });
            }
            catch(error) {
                console.error("Volume Data Upload: Some old files failed to be deleted");
            }
        }
    }

    /**
     * @param {String} settingsFilePath
     * @param {String} rawFileName
     */
    static async correctRawFilePathInSettings(settingsFilePath, rawFileName) {
        const contents = await readFile(settingsFilePath, { encoding: "utf8" });
        const settings = JSON.parse(contents);
        settings["file"] = rawFileName;
        if (!Object.hasOwn(settings, "transferFunction")) {
            settings["transferFunction"] = "tf-default.json";
        }
        await writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
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

    prepareDataForDownload(
        downloadRawFile = true,
        downloadSettingsFile = true
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

        if (!hasFiles) {
            throw new Error("No files to download.");
        }

        const outputFileName = path.parse(this.path).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer(),
        };
    }

    async deleteRawFile() {
        if (this.rawFile == null) {
            throw new Error("Raw volume does not have a raw file");
        }
        await this.rawFile.delete();
        this.rawFile = null;
    }

    async deleteSettingsFile() {
        if (this.settingsFile == null) {
            throw new Error("Raw volume does not have a settings file");
        }
        await this.settingsFile.delete();
        this.settingsFile = null;
    }

    /**
     * @return {Promise<Number>}
     */
    static async deleteZombies() {
        const res = await this.db.deleteMany({
            where: {
                NOT: {
                    projects: { some: {} },
                },
            },
        });

        return res.count;
    }
}
