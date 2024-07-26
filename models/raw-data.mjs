import {Downloadable} from "./downloadable.mjs";

export class RawData extends Downloadable {
    constructor(name, path) {
        super(path);
        this.name = name;
        Object.preventExtensions(this);
    }

    static fromReference(dbRawData) {
        return new RawData(dbRawData.name, dbRawData.path);
    }
}