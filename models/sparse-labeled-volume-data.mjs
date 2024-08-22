// @ts-check

import { VolumeData } from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
/**
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @extends {VolumeData}
 */
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

    static get folderPath() {
        return "pseudo-labeled-volume-data";
    }

    /**
     * @param {Number} id
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<SparseLabelVolumeDataDB>}
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
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async del(id) {
        return await super.del(id);
    }
}
