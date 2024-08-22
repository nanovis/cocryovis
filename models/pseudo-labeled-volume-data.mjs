// @ts-check

import { VolumeData } from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
/**
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoVolumeDataDB
 */

/**
 * @extends {VolumeData}
 */
export class PseudoLabeledVolumeData extends VolumeData {
    /**
     * @return {String}
     */
    static get modelName() {
        return "pseudoLabelVolumeData";
    }

    static get db() {
        return prismaManager.db.pseudoLabelVolumeData;
    }

    static get folderPath() {
        return "pseudo-labeled-volume-data";
    }

    /**
     * @param {Number} id
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<PseudoVolumeDataDB>}
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
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async del(id) {
        return await super.del(id);
    }
}
