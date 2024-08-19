// @ts-check

import { BaseModel } from "./base-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { Checkpoint } from "./checkpoint.mjs";

/**
 * @typedef { import("@prisma/client").Model } ModelDB
 */

export class Model extends BaseModel {
    /**
     * @return {String}
     */
    static get modelName() {
        return "model";
    }

    static get db() {
        return prismaManager.db.model;
    }

    /**
     * @param {Number} id
     * @return {Promise<ModelDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} id
     */
    static async getByIdDeep(id) {
        let entry = await this.db.findUnique({
            where: { id: id },
            include: {
                checkpoints: true,
            },
        });
        if (!entry) {
            throw new Error(`Cannot find ${this.modelName} with ID ${id}`);
        }
        return entry;
    }

    /**
     * @param {String} name
     * @param {String} description
     * @param {Number} ownerId
     * @param {Number} projectId
     * @return {Promise<ModelDB>}
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
     * @return {Promise<ModelDB>}
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
        let deletedCheckpoints = 0;
        if (res.count > 0) {
            deletedCheckpoints = (await Checkpoint.deleteZombies()).count;
        }

        return {
            deletedModels: res.count,
            deletedCheckpoints: deletedCheckpoints,
        };
    }

    /**
     * @param {Number} id
     * @return {Promise<ModelDB>}
     */
    static async del(id) {
        return await super.del(id);
    }
}
