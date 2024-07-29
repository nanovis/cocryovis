import fileSystem from "fs";
import path from "path";
import AdmZip from "adm-zip";

export function fileNameFilter(name) {
    return name.replace(/\s+/g, '_').replace(/[^\da-zA-Z_.]+/g, '');
}

export async function saveData(files, uploadPath, acceptedFileExtensions = [], singleFileOnly = false) {
    function isFileExtensionAccepted(filename, acceptedFileExtensions) {
        return acceptedFileExtensions.length === 0 || acceptedFileExtensions.some(extension => filename.endsWith(extension));
    }

    const fileNames = [];
    const filePaths = [];

    const promises = [];

    if (!fileSystem.existsSync(uploadPath)) {
        fileSystem.mkdirSync(uploadPath, {recursive: true});
    }
    if (Array.isArray(files)) {
        for (const file of files) {
            if (isFileExtensionAccepted(file.name, acceptedFileExtensions)) {
                const filteredFileName = fileNameFilter(file.name);
                const fullPath = path.join(uploadPath, filteredFileName);
                fileNames.push(filteredFileName);
                filePaths.push(fullPath);
                promises.push(file.mv(fullPath));
                if (singleFileOnly) {
                    break;
                }
            }
        }
    } else if (files.name.endsWith('.zip')) {
        let zip = new AdmZip(files.data);
        const zipEntries = zip.getEntries();
        for (const entry of zipEntries) {
            if (isFileExtensionAccepted(entry.name, acceptedFileExtensions)) {
                const filteredFileName = fileNameFilter(entry.name);
                zip.extractEntryTo(entry, uploadPath, false, true, false, filteredFileName);
                fileNames.push(filteredFileName);
                filePaths.push(path.join(uploadPath, filteredFileName));
                if (singleFileOnly) {
                    break;
                }
            }
        }
    } else if (isFileExtensionAccepted(files.name, acceptedFileExtensions)) {
        const filteredFileName = fileNameFilter(files.name);
        const fullPath = path.join(uploadPath, filteredFileName);
        await files.mv(fullPath);
        fileNames.push(filteredFileName);
        filePaths.push(path.join(uploadPath, filteredFileName));
    }

    await Promise.all(promises);

    return {fileNames: fileNames, filePaths: filePaths};
}