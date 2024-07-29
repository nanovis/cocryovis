import {Downloadable} from "./downloadable.mjs";

export class PseudoLabeledVolume extends Downloadable {
    constructor(name, path, id) {
        super(path);
        this.name = name;
        this.id;
        Object.preventExtensions(this);
    }

    static createPseudoLabeledVolume(name, path) {
        return new PseudoLabeledVolume(name, path);
    }

    static fromReference(dbReference) {
        return new PseudoLabeledVolume(dbReference.name, dbReference.path, dbReference.id);
    }
}