import {isFileExtensionAccepted} from "../tools/utils.mjs";
import {readFile, writeFile} from 'node:fs/promises';
import {StoredFile} from "./stored-file.mjs";

export class SettingsFile extends StoredFile {
    static acceptedFileExtensions = [".json"];

    constructor(fileName, filePath) {
        super(fileName, filePath);
    }

    static isSettingsFile(fileName) {
        return isFileExtensionAccepted(fileName, SettingsFile.acceptedFileExtensions);
    }

    static async fromFile(file, uploadPath, moveFunction) {
        return super.fromFile(file, uploadPath, SettingsFile.acceptedFileExtensions, moveFunction);
    }

    async readFile() {
        const contents = await readFile(this.filePath, { encoding: 'utf8' });
        return JSON.parse(contents);
    }

    async setRawFilePath(rawFilePath) {
        try {
            const settings = await this.readFile();
            settings["file"] = rawFilePath;
            if (!Object.hasOwn(settings, 'transferFunction')) {
                settings["transferFunction"] = "tf-default.json";
            }
            await writeFile(this.filePath, JSON.stringify(settings, null, 2));
        } catch (err) {
            console.error(err.message);
        }
    }
}