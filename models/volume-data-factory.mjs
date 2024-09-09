// @ts-check

import RawVolumeData from "./raw-volume-data.mjs";
import SparseLabeledVolumeData from "./sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";

export class VolumeDataType {
    static RawVolumeData = new VolumeDataType("RawVolumeData");
    static SparseLabeledVolumeData = new VolumeDataType(
        "SparseLabeledVolumeData"
    );
    static PseudoLabeledVolumeData = new VolumeDataType(
        "PseudoLabeledVolumeData"
    );

    /**
     * @param {String} name
     */
    static mapName(name) {
        switch (name) {
            case this.RawVolumeData.name:
                return this.RawVolumeData;
            case this.SparseLabeledVolumeData.name:
                return this.SparseLabeledVolumeData;
            case this.PseudoLabeledVolumeData.name:
                return this.PseudoLabeledVolumeData;
        }
        throw new Error("Unknown Volume Data Type");
    }

    /**
     * @param {String} name
     */
    constructor(name) {
        /** @type {String} */
        this.name = name;
    }
}

export class VolumeDataFactory {
    /**
     * @param {VolumeDataType} type
     */
    static getClass(type) {
        switch (type) {
            case VolumeDataType.RawVolumeData:
                return RawVolumeData;
            case VolumeDataType.SparseLabeledVolumeData:
                return SparseLabeledVolumeData;
            case VolumeDataType.PseudoLabeledVolumeData:
                return PseudoLabeledVolumeData;
        }
        throw new Error("Volume Data Type Not Found");
    }
}
