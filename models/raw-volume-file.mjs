import {isFileExtensionAccepted} from "../tools/utils.mjs";
import {StoredFile} from "./stored-file.mjs";

export class RawVolumeFile extends StoredFile {
    static acceptedFileExtensions = [".raw", ".msc"];

    constructor(fileName, filePath) {
        super(fileName, filePath);
    }

    static isRawVolumeFile(fileName) {
        return isFileExtensionAccepted(fileName, RawVolumeFile.acceptedFileExtensions);
    }

    static async fromFile(file, uploadPath, moveFunction) {
        return super.fromFile(file, uploadPath, RawVolumeFile.acceptedFileExtensions, moveFunction);
    }
}