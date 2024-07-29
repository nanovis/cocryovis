import AdmZip from "adm-zip";
import path from "path";

export class Downloadable {
    path;

    constructor(path) {
        if(this.constructor === Downloadable) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        this.path = path;
    }

    prepareDataForDownload() {
        const zip = new AdmZip();
        zip.addLocalFile(this.path);
        const outputFileName = path.parse(this.path).name;
        return {
            name: `${outputFileName}.zip`,
            zipBuffer: zip.toBuffer()
        };
    }
}