// @ts-check

import { VolumeData, RawVolumeFile, SettingsFile } from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";

export class SparseLabeledVolumeData extends VolumeData {
    /**
     * @return {String}
     */
    static get modelName() {
        return "sparseLabelVolumeData";
    }

    static get db() {
        return prismaManager.db.sparseLabelVolumeData;
    }

    static get getFolderPath() {
        return "pseudo-labeled-volume-data";
    }

    /**
     * @param {Number} id
     * @param {Number} userId
     * @param {String} path
     * @param {RawVolumeFile} rawFile
     * @param {SettingsFile} settingsFile
     */
    constructor(id, userId, path, rawFile = null, settingsFile = null) {
        super(id, userId, path, rawFile, settingsFile);
    }

    /**
     * @param {Number} id
     * @return {Promise<SparseLabeledVolumeData>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<SparseLabeledVolumeData>}
     */
    static async create(ownerId, volumeId) {
        return await super.create(ownerId, volumeId);
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {Number} [userId]
     * @property {String} [path]
     * @property {String?} [rawFilePath]
     * @property {String?} [rawFileName]
     * @property {String?} [settingsFilePath]
     * @property {String?} [settingsFileName]
     * @param {Changes} changes
     * @return {Promise<SparseLabeledVolumeData>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<SparseLabeledVolumeData>}
     */
    static async del(id) {
        return await super.del(id);
    }
}
