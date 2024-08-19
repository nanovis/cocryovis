// @ts-check

import AdmZip from "adm-zip";
import path from "path";
import { rm, access, mkdir, readFile, writeFile } from "node:fs/promises";
import fileSystem from "fs";
import { BaseModel } from "./base-model.mjs";
import appConfig from "../tools/config.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { fileNameFilter, isFileExtensionAccepted } from "../tools/utils.mjs";

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

    async uploadFiles(files) {
        this.rawFileUploaded = false;
        this.settingsFileUploaded = false;

        try {
            await access(this.path);
        } catch (error) {
            await mkdir(this.path, { recursive: true });
        }

        if (Array.isArray(files)) {
            for (const file of files) {
                await this.uploadFile(
                    file,
                    (file, filteredFileName, fullPath) => file.mv(fullPath)
                );
            }
        } else if (files.name.endsWith(".zip")) {
            let zip = new AdmZip(files.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                await this.uploadFile(
                    entry,
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
            }
        } else {
            await this.uploadFile(files, (file, filteredFileName, fullPath) =>
                file.mv(fullPath)
            );
        }

        if (!this.rawFileUploaded && !this.settingsFileUploaded) {
            throw new Error("No valid files provided");
        }

        const changes = {};
        if (this.rawFileUploaded && this.rawFile) {
            changes.rawFilePath = this.rawFile.filePath;
        }

        if (this.settingsFileUploaded && this.settingsFile) {
            changes.settingsFilePath = this.settingsFile.filePath;
        }

        await Object.getPrototypeOf(this).constructor.update(this.id, changes);

        delete this.rawFileUploaded;
        delete this.settingsFileUploaded;
    }

    async uploadFile(file, moveFunction) {
        if (
            (this.rawFileUploaded === undefined || !this.rawFileUploaded) &&
            RawVolumeFile.isRawVolumeFile(file.name)
        ) {
            if (this.rawFileUploaded !== undefined) {
                this.rawFileUploaded = true;
            }
            if (this.rawFile) {
                await this.deleteRawFile();
            }
            this.rawFile = await RawVolumeFile.fromFile(
                file,
                this.path,
                moveFunction
            );
            await this.#setRawFilePathInSettings();
        }
        if (
            (this.settingsFileUploaded === undefined ||
                !this.settingsFileUploaded) &&
            SettingsFile.isSettingsFile(file.name)
        ) {
            if (this.settingsFileUploaded !== undefined) {
                this.settingsFileUploaded = true;
            }
            if (this.settingsFile) {
                await this.deleteSettingsFile();
            }
            this.settingsFile = await SettingsFile.fromFile(
                file,
                this.path,
                moveFunction
            );
            await this.#setRawFilePathInSettings();
        }
    }

    async #setRawFilePathInSettings() {
        if (this.rawFile == null || this.settingsFile == null) {
            return;
        }
        await this.settingsFile.setRawFilePath(this.rawFile.fileName);
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
