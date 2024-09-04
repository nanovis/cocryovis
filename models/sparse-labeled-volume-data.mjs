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
        return "sparse-labeled-volume-data";
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

    /**
     * @param {Number[]} ids
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @return {Promise<String[]>}
     */
    static async deleteZombies(ids, tx) {
        if (ids.length === 0) {
            return [];
        }
        const sparseVolumes = await tx.sparseLabelVolumeData.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    volumes: {
                        none: {},
                    },
                },
            },
        });
        await tx.sparseLabelVolumeData.deleteMany({
            where: {
                id: {
                    in: sparseVolumes.map((v) => v.id),
                },
            },
        });
        const fileDeleteStack = [];
        sparseVolumes.forEach((v) =>
            fileDeleteStack.push(...this.getFilePaths(v))
        );

        return fileDeleteStack;
    }
}
