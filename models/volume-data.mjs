import AdmZip from "adm-zip";
import path from "path";
import {RawVolumeFile} from "./raw-volume-file.mjs";
import {SettingsFile} from "./settings-volume-file.mjs";
import {StoredFile} from "./stored-file.mjs";
import {writeFile, rm, access, mkdir} from 'node:fs/promises';

export class VolumeData {
    static configFileName = "config.json";

    constructor(path, rawFile = null, settingsFile = null, configFile = null) {
        this.path = path;
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
        return new VolumeData(dbReference.path, rawFile, settingsFile, configFile);
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
            this.rawFileUploaded = true;
            if (this.rawFile) {
                this.rawFile.delete();
            }
            this.rawFile = await RawVolumeFile.fromFile(file, this.path, moveFunction);
            await this.#setRawFilePathInSettings();
        }
        if ((this.settingsFileUploaded === undefined || !this.settingsFileUploaded) && SettingsFile.isSettingsFile(file.name)) {
            this.settingsFileUploaded = true;
            if (this.settingsFile) {
                this.settingsFile.delete();
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
}