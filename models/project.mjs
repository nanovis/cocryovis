// @ts-check

import { BaseModel } from "./base-model.mjs";
import { Volume } from "./volume.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { Model } from "./model.mjs";

/**
 * @typedef { import("@prisma/client").Project } ProjectDB
 */

export class Project extends BaseModel {
    /**
     * @return {String}
     */
    static get modelName() {
        return "project";
    }

    static get db() {
        return prismaManager.db.project;
    }

    /**
     * @param {Number} userId
     * @return {Promise<ProjectDB[]>}
     */
    static async getUserProjects(userId) {
        return await this.db.findMany({
            where: {
                ownerId: userId,
            },
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<ProjectDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} id
     * @return {Promise<ProjectDB>}
     */
    static async getByIdDeep(id) {
        return await this.db.findUnique({
            where: {
                id: id,
            },
            include: {
                volumes: {
                    include: {
                        rawData: {
                            include: {
                                results: true,
                            },
                        },
                        sparseVolumes: true,
                        pseudoVolumes: true,
                    },
                },
                models: {
                    include: {
                        checkpoints: true,
                    },
                },
            },
        });
    }

    /**
     * @param {String} name
     * @param {String} description
     * @param {Number} ownerId
     * @return {Promise<ProjectDB>}
     */
    static async create(name, description, ownerId) {
        return await prismaManager.db.project.create({
            data: { name: name, description: description, ownerId: ownerId },
        });
    }

    /**
     * @param {Number} id
     * @typedef {Object} Changes
     * @property {String?} name
     * @property {String?} description
     * @property {Number} userId
     * @param {Changes} changes
     * @return {Promise<ProjectDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<ProjectDB>}
     */
    static async del(id) {
        // const [project, volumes] = await prismaManager.db.$transaction([
        //     this.db.delete({ where: { id: id } }),
        //     Volume.deleteZombieVolumes(),
        // ]);
        const project = this.db.delete({ where: { id: id } });
        Volume.deleteZombies();
        Model.deleteZombies();

        return project;
    }
}
