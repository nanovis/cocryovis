import AdmZip from "adm-zip";
import path from "path";
import {RawVolumeFile} from "./raw-volume-file.mjs";
import {SettingsFile} from "./settings-file.mjs";
import {StoredFile} from "./stored-file.mjs";
import {writeFile, rm, access, mkdir} from 'node:fs/promises';
import {isFileExtensionAccepted} from "../tools/utils.mjs";
import {StoredFolder} from "./stored-folder.mjs";
import {rawToTiff} from "../tools/raw-to-tiff.mjs";

export class VolumeData {
    static configFileName = "config.json";

    static subfolders = {
        "tiffFiles": "tiff-files"
    }

    constructor(path, rawFile = null, settingsFile = null, configFile = null, tiffFolder = null) {
        this.path = path;
        this.rawFile = rawFile;
        this.settingsFile = settingsFile;
        this.configFile = configFile;
        this.tiffFolder = tiffFolder;
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
        if (this.tiffFolder) {
            this.tiffFolder.delete();
        }
        await rm(this.path, { recursive: true, force: true });
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
        let tiffFolder = null;
        if (dbReference.tiffFolder) {
            tiffFolder = StoredFolder.fromReference(dbReference.tiffFolder);
        }
        return new VolumeData(dbReference.path, rawFile, settingsFile, configFile, tiffFolder);
    }

    async uploadFiles(files) {
        this.rawFileUploaded = false;
        this.settingsFileUploaded = false;
        this.tiffFileUploaded = false;

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

        if (!this.rawFileUploaded && !this.settingsFileUploaded && !this.tiffFileUploaded) {
            throw new Error("No valid files provided");
        }

        delete this.rawFileUploaded;
        delete this.settingsFileUploaded;
        delete this.tiffFileUploaded;

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
        if (isFileExtensionAccepted(file.name, [".tif,", ".tiff"])) {
            if (this.tiffFolder == null) {
                this.tiffFolder =
                    new StoredFolder(VolumeData.subfolders.tiffFiles, path.join(this.path, VolumeData.subfolders.tiffFiles));
            }
            else if (this.tiffFileUploaded !== undefined && !this.tiffFileUploaded) {
                await this.deleteTiffFolder();
            }
            if (this.settingsFileUploaded !== undefined) {
                this.tiffFileUploaded = true;
            }
            await this.tiffFolder.addFile(file, moveFunction);
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

    prepareDataForDownload(downloadRawFile = true, downloadSettingsFile = true, downloadTiffFiles = false) {
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
        if (downloadTiffFiles && this.tiffFolder != null) {
            zip.addLocalFolder(this.tiffFolder.folderPath);
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

    async convertRawToTiff() {
        if (this.rawFile == null) {
            throw new Error("Volume is missing a raw file.");
        }
        if (this.settingsFile == null) {
            throw new Error("Volume requires a settings file with size property.");
        }
        const settings = await this.settingsFile.readFile();
        if (!Object.hasOwn(settings, "size")) {
            throw new Error("Volume requires a settings file with size property.");
        }
        const width = settings.size.x;
        const height = settings.size.y;
        const depth = settings.size.z;
        let channels = 1;
        if (Object.hasOwn(settings, "bytesPerVoxel")) {
            channels = settings["bytesPerVoxel"];
        }
        if (this.tiffFolder != null) {
            await this.deleteTiffFolder();
        }

        const tiffFolderPath = path.join(this.path, VolumeData.subfolders.tiffFiles);

        await rawToTiff(this.rawFile.filePath, tiffFolderPath, width, height, depth, channels);

        this.tiffFolder =
            new StoredFolder(VolumeData.subfolders.tiffFiles, tiffFolderPath);
    }

    async deleteRawFile() {
        if (this.rawFile == null) {
            throw new Error("Raw volume does not have a raw file");
        }
        this.rawFile.delete();
        this.rawFile = null;
    }
    async deleteSettingsFile() {
        if (this.settingsFile == null) {
            throw new Error("Raw volume does not have a settings file");
        }
        this.settingsFile.delete();
        this.settingsFile = null;
    }
    async deleteTiffFolder() {
        if (this.tiffFolder == null) {
            throw new Error("Raw volume does not have any tiff files");
        }
        this.tiffFolder.delete();
        this.tiffFolder = null;
    }
}