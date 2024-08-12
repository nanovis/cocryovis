export class VolumeDataStack {
    constructor(type, maxSize, ids = []) {
        this.type = type;
        this.maxSize = maxSize;
        this.ids = ids;
    }

    static fromReference(dbReference) {
        return new VolumeDataStack(dbReference.type, dbReference.maxSize, dbReference.ids);
    }

    canAddMoreVolumes() {
        return this.ids.length < this.maxSize;
    }

    addVolumeData(volumeDataId) {
        if (this.ids.length >= this.maxSize) {
            throw new Error(`Maximum amount of volumes in a stack reached (${this.maxSize})`);
        }
        this.ids.push(volumeDataId);
    }

    removeVolumeData(volumeDataId) {
        const index = this.ids.findIndex(id => id === volumeDataId);
        if (index === -1) {
            throw new Error(`Volume does not contain volume data ${volumeDataId}.`);
        }
        this.ids.splice(index, 1);
    }

    async delete() {
    }

    // static isValidFile(fileName) {
    //     return SettingsFile.isValidFile(fileName) || RawVolumeFile.isValidFile(fileName);
    // }
    //
    // async uploadFiles(files) {
    //     let anyFilesMissing = false;
    //     for (const fileName of files) {
    //
    //     }
    //
    //     try {
    //         await access(this.path);
    //     } catch (error) {
    //         await mkdir(this.path, {recursive: true});
    //     }
    //
    //     const validFiles = [];
    //     const validZipEntries = [];
    //
    //     if (Array.isArray(files)) {
    //         for (const file of files) {
    //             if (VolumeDataStack.isValidFile(file)) {
    //                 validFiles.push(file);
    //             }
    //         }
    //     } else if (files.name.endsWith('.zip')) {
    //         let zip = new AdmZip(files.data);
    //         const zipEntries = zip.getEntries();
    //         for (const entry of zipEntries) {
    //             validZipEntries.push(entry);
    //         }
    //     } else {
    //         validFiles.push(files);
    //     }
    //
    //     while() {
    //
    //     }
    // }
    //
    // async uploadFile(file, moveFunction) {
    //     if ((this.rawFileUploaded === undefined || !this.rawFileUploaded) && RawVolumeFile.isRawVolumeFile(file.name)) {
    //         if (this.rawFileUploaded !== undefined) {
    //             this.rawFileUploaded = true;
    //         }
    //         if (this.rawFile) {
    //             await this.deleteRawFile();
    //         }
    //         this.rawFile = await RawVolumeFile.fromFile(file, this.path, moveFunction);
    //         await this.#setRawFilePathInSettings();
    //     }
    //     if ((this.settingsFileUploaded === undefined || !this.settingsFileUploaded) && SettingsFile.isSettingsFile(file.name)) {
    //         if (this.settingsFileUploaded !== undefined) {
    //             this.settingsFileUploaded = true;
    //         }
    //         if (this.settingsFile) {
    //             await this.deleteSettingsFile();
    //         }
    //         this.settingsFile = await SettingsFile.fromFile(file, this.path, moveFunction);
    //         await this.createConfigFile();
    //         await this.#setRawFilePathInSettings();
    //     }
    //     if (isFileExtensionAccepted(file.name, [".tif,", ".tiff"])) {
    //         if (this.tiffFolder == null) {
    //             this.tiffFolder =
    //                 new StoredFolder(VolumeData.subfolders.tiffFiles, path.join(this.path, VolumeData.subfolders.tiffFiles));
    //         }
    //         else if (this.tiffFileUploaded !== undefined && !this.tiffFileUploaded) {
    //             await this.deleteTiffFolder();
    //         }
    //         if (this.settingsFileUploaded !== undefined) {
    //             this.tiffFileUploaded = true;
    //         }
    //         await this.tiffFolder.addFile(file, moveFunction);
    //     }
    // }

    // prepareDataForDownload(downloadRawFile = true, downloadSettingsFile = true, downloadTiffFiles = false) {
    //     let hasFiles = false;
    //
    //     const zip = new AdmZip();
    //     if (downloadRawFile && this.rawFile != null) {
    //         zip.addLocalFile(this.rawFile.filePath);
    //         hasFiles = true;
    //     }
    //     if (downloadSettingsFile && this.settingsFile != null) {
    //         zip.addLocalFile(this.settingsFile.filePath);
    //         hasFiles = true;
    //     }
    //     if (downloadTiffFiles && this.tiffFolder != null) {
    //         zip.addLocalFolder(this.tiffFolder.folderPath);
    //         hasFiles = true;
    //     }
    //
    //     if (!hasFiles) {
    //         throw new Error("No files to download.");
    //     }
    //
    //     const outputFileName = path.parse(this.path).name;
    //     return {
    //         name: `${outputFileName}.zip`,
    //         zipBuffer: zip.toBuffer()
    //     };
    // }
}