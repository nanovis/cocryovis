import {isFileExtensionAccepted} from "../tools/utils.mjs";
import {StoredFile} from "./stored-file.mjs";

export class MrcVolumeFile extends StoredFile {
    static acceptedFileExtensions = [".mrc"];

    constructor(fileName, filePath) {
        super(fileName, filePath);
    }

    static isMrcVolumeFile(fileName) {
        return isFileExtensionAccepted(fileName, MrcVolumeFile.acceptedFileExtensions);
    }

    static async fromFile(file, uploadPath, moveFunction) {
        const storedFile = await super.fromFile(file, uploadPath, MrcVolumeFile.acceptedFileExtensions, moveFunction);
        return new MrcVolumeFile(storedFile.fileName, storedFile.filePath);
    }
}