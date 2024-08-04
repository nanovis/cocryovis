import {fileNameFilter, isFileExtensionAccepted} from "../tools/utils.mjs";
import path from "path";
import {StoredFile} from "./stored-file.mjs";

export class UploadableFile extends StoredFile {
    constructor(fileName, filePath) {
        super(fileName, filePath);
    }

    static async fromFile(file, uploadPath, acceptedFileExtensions, moveFunction) {
        if (isFileExtensionAccepted(file.name, acceptedFileExtensions)) {
            const filteredFileName = fileNameFilter(file.name);
            const fullPath = path.join(uploadPath, filteredFileName);
            await moveFunction(file, filteredFileName, fullPath);
            return new this(filteredFileName, fullPath);
        }
        throw new Error("Incorrect file extension");
    }
}