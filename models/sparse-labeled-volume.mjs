import {Downloadable} from "./downloadable.mjs";
import fileSystem from "fs";

export class SparseLabeledVolume extends Downloadable {
    constructor(id, name, path) {
        super(path);
        this.id = id;
        this.name = name;
        Object.preventExtensions(this);
    }

    static createSparseLabeledVolume(id, name, path) {
        return new SparseLabeledVolume(id, name, path);
    }

    static fromReference(dbReference) {
        return new SparseLabeledVolume(dbReference.id, dbReference.name, dbReference.path);
    }

    async delete() {
        await fileSystem.rm(this.path, { recursive: true, force: true }, (err) => {
            if (err) {
                console.log(`Error deleting raw data ${this.name}: ${err}.`);
            }
        });
    }
}