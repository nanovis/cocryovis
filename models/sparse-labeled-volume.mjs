import {Downloadable} from "./downloadable.mjs";

export class SparseLabeledVolume extends Downloadable {
    constructor(name, path, id) {
        super(path);
        this.name = name;
        this.id = id;
        Object.preventExtensions(this);
    }

    static createSparseLabeledVolume(name, path) {
        return new SparseLabeledVolume(name, path);
    }

    static fromReference(dbReference) {
        return new SparseLabeledVolume(dbReference.name, dbReference.path, dbReference.id);
    }
}