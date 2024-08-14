import AdmZip from "adm-zip";
import path from "path";
import {RawVolumeFile} from "./raw-volume-file.mjs";
import {SettingsFile} from "./settings-file.mjs";
import {StoredFile} from "./stored-file.mjs";
import {writeFile, rm, access, mkdir} from 'node:fs/promises';
import fileSystem from "fs";
import {MrcVolumeFile} from "./mrc-volume-file.mjs";
import {mrcToRaw} from "../tools/utils.mjs";

export class VolumeData {
    static volumeTypes = {
        "rawData": "rawData",
        "sparseLabels": "sparseLabels",
        "pseudoLabels": "pseudoLabels"
    }

    constructor(id, type, userId, path, volumeIds = [], rawFile = null,
                settingsFile = null, mrcFile = null) {
        this.id = id;
        this.type = type;
        this.userId = userId;
        this.path = path;
        this.volumeIds = volumeIds;
        this.rawFile = rawFile;
        this.settingsFile = settingsFile;
        this.mrcFile = mrcFile;
    }

    async delete() {
        if (this.rawFile) {
            this.rawFile.delete();
        }
        if (this.settingsFile) {
            this.settingsFile.delete();
        }
        if (this.mrcFile) {
            this.mrcFile.delete();
        }
        await rm(this.path, { recursive: true, force: true });
    }

    static createVolumeData(id, type, userId, volumeId, basePath) {
        const folderPath = path.join(basePath, id.toString());
        if (fileSystem.existsSync(folderPath)) {
            throw new Error(`Volume directory already exists`);
        }
        fileSystem.mkdirSync(folderPath, {recursive: true});

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
        let mrcFile = null;
        if (dbReference.mrcFile) {
            mrcFile = MrcVolumeFile.fromReference(dbReference.mrcFile);
        }
        return new this(dbReference.id, dbReference.type, dbReference.userId, dbReference.path, dbReference.volumeIds,
            rawFile, settingsFile, mrcFile);
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
    }

    async uploadFile(file, moveFunction) {
        if ((this.rawFileUploaded === undefined || !this.rawFileUploaded) &&
            RawVolumeFile.isRawVolumeFile(file.name) &&
            (this.type === VolumeData.volumeTypes.rawData || path.extname(file.name) === '.raw'))
        {
            if (this.rawFileUploaded !== undefined) {
                this.rawFileUploaded = true;
            }
            if (this.rawFile) {
                await this.deleteRawFile();
            }
            this.rawFile = await RawVolumeFile.fromFile(file, this.path, moveFunction);
            await this.#setRawFilePathInSettings();
        }
        if ((this.settingsFileUploaded === undefined || !this.settingsFileUploaded) &&
            SettingsFile.isSettingsFile(file.name))
        {
            if (this.settingsFileUploaded !== undefined) {
                this.settingsFileUploaded = true;
            }
            if (this.settingsFile) {
                await this.deleteSettingsFile();
            }
            this.settingsFile = await SettingsFile.fromFile(file, this.path, moveFunction);
            await this.#setRawFilePathInSettings();
        }
    }

    async uploadMrcFile(file) {
        if (this.type !== VolumeData.volumeTypes.rawData) {
            throw new Error("Only Raw Data supports MRC files.");
        }

        if (!fileSystem.existsSync(this.path)) {
            fileSystem.mkdirSync(this.path, { recursive: true });
        }

        let uploadSuccessful = false;

        if (Array.isArray(file)) {
            throw new Error("When adding MRC data, only a single file can be selected.");
        } else if (file.name.endsWith('.zip')) {
            let zip = new AdmZip(file.data);
            const zipEntries = zip.getEntries();
            for (const entry of zipEntries) {
                if (MrcVolumeFile.isMrcVolumeFile(entry.name)) {
                    if (this.mrcFile) {
                        await this.deleteMrcFile();
                    }
                    this.mrcFile = await MrcVolumeFile.fromFile(file, this.path, (file, filteredFileName, fullPath) =>
                        zip.extractEntryTo(entry, this.path, false, true, false, filteredFileName));
                    uploadSuccessful = true;
                    break;
                }
            }
        } else if (MrcVolumeFile.isMrcVolumeFile(file.name)) {
            if (this.mrcFile) {
                await this.deleteMrcFile();
            }
            this.mrcFile = await MrcVolumeFile.fromFile(file, this.path,
                (file, filteredFileName, fullPath) => file.mv(fullPath));
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

        const {rawFilePath, settingsFilePath} = await mrcToRaw(this.mrcFile.filePath, this.path);
        this.rawFile = new RawVolumeFile(path.parse(rawFilePath).base, rawFilePath);
        this.settingsFile = new SettingsFile(path.parse(settingsFilePath).base, settingsFilePath);
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

    async deleteMrcFile() {
        if (this.mrcFile == null) {
            throw new Error("Raw volume does not have a mrc file");
        }
        await this.mrcFile.delete();
        this.mrcFile = null;
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