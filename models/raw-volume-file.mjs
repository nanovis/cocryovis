import {isFileExtensionAccepted} from "../tools/utils.mjs";
import {StoredFile} from "./stored-file.mjs";

export class RawVolumeFile extends StoredFile {
    static acceptedFileExtensions = [".raw"];

    constructor(fileName, filePath) {
        super(fileName, filePath);
    }

    static isRawVolumeFile(fileName) {
        return isFileExtensionAccepted(fileName, RawVolumeFile.acceptedFileExtensions);
    }

    static async fromFile(file, uploadPath, moveFunction) {
        const storedFile = await super.fromFile(file, uploadPath, RawVolumeFile.acceptedFileExtensions, moveFunction);
        return new RawVolumeFile(storedFile.fileName, storedFile.filePath);
    }
}