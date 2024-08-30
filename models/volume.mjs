// @ts-check

import { BaseModel } from "./base-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { RawVolumeData } from "./raw-volume-data.mjs";
import { SparseLabeledVolumeData } from "./sparse-labeled-volume-data.mjs";
import { PseudoLabeledVolumeData } from "./pseudo-labeled-volume-data.mjs";

/**
 * @typedef { import("@prisma/client").Volume } VolumeDB
 */

export class Volume extends BaseModel {
    /**
     * @return {String}
     */
    static get modelName() {
        return "volume";
    }

    static get db() {
        return prismaManager.db.volume;
    }

    /**
     * @param {Number} id
     * @return {Promise<VolumeDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} id
     */
    static async getByIdDeep(
        id,
        { rawData = false, sparseVolumes = false, pseudoVolumes = false }
    ) {
        let entry = await this.db.findUnique({
            where: { id: id },
            include: {
                rawData: rawData,
                sparseVolumes: sparseVolumes,
                pseudoVolumes: pseudoVolumes,
            },
        });
        if (!entry) {
            throw new Error(`Cannot find ${this.modelName} with ID ${id}`);
        }
        return entry;
    }

    /**
     * @param {Number[]} ids
     */
    static async getMultipleByIdDeep(
        ids,
        { rawData = false, sparseVolumes = false, pseudoVolumes = false }
    ) {
        let entry = await this.db.findMany({
            where: { id: { in: ids } },
            include: {
                rawData: rawData,
                sparseVolumes: sparseVolumes,
                pseudoVolumes: pseudoVolumes,
            },
        });
        return entry;
    }

    /**
     * @param {Number} id
     * @return {Promise<VolumeDB>}
     */
    static async getNumberOfProjects(id) {
        return await this.db.findUnique({
            where: { id: id },
            include: {
                _count: {
                    select: { projects: true },
                },
            },
        });
    }

    /**
     * @param {String} name
     * @param {String} description
     * @param {Number} ownerId
     * @param {Number} projectId
     * @return {Promise<VolumeDB>}
     */
    static async create(name, description, ownerId, projectId) {
        return await this.db.create({
            data: {
                name: name,
                description: description,
                ownerId: ownerId,
                projects: {
                    connect: { id: projectId },
                },
            },
        });
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {String} [name]
     * @property {String} [description]
     * @property {Number} [ownerId]
     * @param {Changes} changes
     * @return {Promise<VolumeDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    // /**
    //  * @return {import("@prisma/client").PrismaPromise<any>}
    //  */
    static async deleteZombies() {
        const res = await this.db.deleteMany({
            where: {
                NOT: {
                    projects: { some: {} },
                },
            },
        });
        let rawVolumeDataDeleted = 0;
        let sparseLabeledVolumeDataDeleted = 0;
        let pseudoLabeledVolumeDataDeleted = 0;
        if (res.count > 0) {
            rawVolumeDataDeleted = await RawVolumeData.deleteZombies();
            sparseLabeledVolumeDataDeleted =
                await SparseLabeledVolumeData.deleteZombies();
            pseudoLabeledVolumeDataDeleted =
                await PseudoLabeledVolumeData.deleteZombies();
        }

        // return prismaManager.db.$executeRaw`
        //     DELETE FROM Volume
        //     WHERE id IN (
        //         SELECT v.id
        //         FROM Volume v
        //         JOIN _ProjectToVolume pv ON v.id = pv."B"
        //         GROUP BY v.id
        //         HAVING COUNT(pv."A") = 1
        //     );
        // `;
        return {
            volumesDeleted: res.count,
            rawVolumeDataDeleted: rawVolumeDataDeleted,
            sparseLabeledVolumeDataDeleted: sparseLabeledVolumeDataDeleted,
            pseudoLabeledVolumeDataDeleted: pseudoLabeledVolumeDataDeleted,
        };
    }

    /**
     * @param {Number} id
     * @return {Promise<VolumeDB>}
     */
    static async del(id) {
        return await super.del(id);
    }
}
