import AdmZip from "adm-zip";
import path from "path";
import {RawVolumeFile} from "./raw-volume-file.mjs";
import {SettingsFile} from "./settings-file.mjs";
import {StoredFile} from "./stored-file.mjs";
import {writeFile, rm, access, mkdir} from 'node:fs/promises';
import {isFileExtensionAccepted} from "../tools/utils.mjs";
import {StoredFolder} from "./stored-folder.mjs";
import fileSystem from "fs";

export class VolumeData {
    static configFileName = "config.json";

    static volumeTypes = {
        "rawData": "rawData",
        "sparseLabels": "sparseLabels",
        "pseudoLabels": "pseudoLabels"
    }

    constructor(id, type, userId, path, volumeIds = [], rawFile = null, settingsFile = null,
                configFile = null) {
        this.id = id;
        this.type = type;
        this.userId = userId;
        this.path = path;
        this.volumeIds = volumeIds;
        this.rawFile = rawFile;
        this.settingsFile = settingsFile;
        this.configFile = configFile;
    }

    async delete() {
        if (this.rawFile) {
            this.rawFile.delete();
        }
        if (this.settingsFile) {
            this.settingsFile.delete();
        }
        if (this.configFile) {
            this.configFile.delete();
        }
        await rm(this.path, { recursive: true, force: true });
    }

    static createVolumeData(id, type, userId, volumeId, basePath) {
        const folderPath = path.join(basePath, id.toString());
        if (fileSystem.existsSync(folderPath)) {
            throw new Error(`Volume directory already exists`);
        }
        fileSystem.mkdirSync(folderPath, {recursive: true});

        for (const subfolder in VolumeData.subfolders) {
            fileSystem.mkdirSync(path.join(folderPath, VolumeData.subfolders[subfolder]));
        }

        return new VolumeData(id, type, userId, folderPath, [volumeId]);
    }

    static fromReference(dbReference) {
        let rawFile = null;
        if (dbReference.rawFile) {
            rawFile = RawVolumeFile.fromReference(dbReference.rawFile);
        }
        let settingsFile = null;
        if (dbReference.settingsFile) {
            settingsFile = SettingsFile.fromReference(dbReference.settingsFile);
        }
        let configFile = null;
        if (dbReference.configFile) {
            configFile = StoredFile.fromReference(dbReference.configFile);
        }
        return new this(dbReference.id, dbReference.type, dbReference.userId, dbReference.path, dbReference.volumeIds,
            rawFile, settingsFile, configFile);
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
            await mkdir(this.path, {recursive: true});
        }

        if (Array.isArray(files)) {
            for (const file of files) {
                await this.uploadFile(file, (file, filteredFileName, fullPath) => file.mv(fullPath));
            }
        } else if (files.name.endsWith('.zip')) {
            let zip = new AdmZip(files.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                await this.uploadFile(entry, (file, filteredFileName, fullPath) =>
                    zip.extractEntryTo(entry, this.path, false, true, false, filteredFileName));
            }
        } else {
            await this.uploadFile(files, (file, filteredFileName, fullPath) => file.mv(fullPath));
        }

        if (!this.rawFileUploaded && !this.settingsFileUploaded) {
            throw new Error("No valid files provided");
        }

        delete this.rawFileUploaded;
        delete this.settingsFileUploaded;

        return this;
    }

    async uploadFile(file, moveFunction) {
        if ((this.rawFileUploaded === undefined || !this.rawFileUploaded) && RawVolumeFile.isRawVolumeFile(file.name)) {
            if (this.rawFileUploaded !== undefined) {
                this.rawFileUploaded = true;
            }
            if (this.rawFile) {
                await this.deleteRawFile();
            }
            this.rawFile = await RawVolumeFile.fromFile(file, this.path, moveFunction);
            await this.#setRawFilePathInSettings();
        }
        if ((this.settingsFileUploaded === undefined || !this.settingsFileUploaded) && SettingsFile.isSettingsFile(file.name)) {
            if (this.settingsFileUploaded !== undefined) {
                this.settingsFileUploaded = true;
            }
            if (this.settingsFile) {
                await this.deleteSettingsFile();
            }
            this.settingsFile = await SettingsFile.fromFile(file, this.path, moveFunction);
            await this.createConfigFile();
            await this.#setRawFilePathInSettings();
        }
    }

    async createConfigFile() {
        if (this.configFile != null) {
            await this.configFile.delete();
        }
        const config = { "files": [] };
        for (let i = 0; i < 5; i++) {
            config.files.push(this.settingsFile.fileName);
        }
        const systemFilePath = path.join(this.path, VolumeData.configFileName);
        await writeFile(systemFilePath, JSON.stringify(config, null, 2));
        this.configFile = new StoredFile(VolumeData.configFileName, systemFilePath);
    }

    async #setRawFilePathInSettings() {
        if (this.rawFile == null || this.settingsFile == null) {
            return;
        }
        await this.settingsFile.setRawFilePath(this.rawFile.fileName);
    }

    prepareDataForDownload(downloadRawFile = true, downloadSettingsFile = true) {
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
            zipBuffer: zip.toBuffer()
        };
    }

    // async convertRawToTiff() {
    //     if (this.rawFile == null) {
    //         throw new Error("Volume is missing a raw file.");
    //     }
    //     if (this.settingsFile == null) {
    //         throw new Error("Volume requires a settings file with size property.");
    //     }
    //     const settings = await this.settingsFile.readFile();
    //     if (!Object.hasOwn(settings, "size")) {
    //         throw new Error("Volume requires a settings file with size property.");
    //     }
    //     const width = settings.size.x;
    //     const height = settings.size.y;
    //     const depth = settings.size.z;
    //     let channels = 1;
    //     if (Object.hasOwn(settings, "bytesPerVoxel")) {
    //         channels = settings["bytesPerVoxel"];
    //     }
    //     if (this.tiffFolder != null) {
    //         await this.deleteTiffFolder();
    //     }
    //
    //     const tiffFolderPath = path.join(this.path, VolumeData.subfolders.tiffFiles);
    //
    //     await rawToTiff(this.rawFile.filePath, tiffFolderPath, width, height, depth, channels);
    //
    //     this.tiffFolder =
    //         new StoredFolder(VolumeData.subfolders.tiffFiles, tiffFolderPath);
    // }

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

    addToVolume(volumeId) {
        if (this.volumeIds.includes(volumeId)) {
            throw new Error(`Volume Data ${this.id}: Volume data is already included in the volume.`);
        }
        this.volumeIds.push(volumeId);
    }

    removeFromVolume(volumeId) {
        const index = this.volumeIds.indexOf(volumeId);
        if (index === -1) {
            throw new Error(`Volume Data ${this.id} (${this.fileName}): Volume data is not included in the volume.`);
        }
        this.volumeIds.splice(index, 1);
    }
}