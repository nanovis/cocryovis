// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import Checkpoint from "./checkpoint.mjs";
import fsPromises from "fs/promises";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Project from "./project.mjs";

/**
 * @typedef { import("@prisma/client").Model } ModelDB
 */

export default class Model extends DatabaseModel {
    static modelName = "model";
    static lockManager = new WriteLockManager(this.modelName);

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
     * @param {Number[]} ids
     * @return {Promise<ModelDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
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
        return Project.withWriteLock(projectId, [this.modelName], () => {
            return this.db.create({
                data: {
                    name: name,
                    description: description,
                    ownerId: ownerId,
                    projects: {
                        connect: { id: projectId },
                    },
                },
            });
        });
    }

    /**
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.ModelUpdateInput} changes
     * @return {Promise<ModelDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<ModelDB>}
     */
    static async del(id) {
        return this.#del(id);
    }

    /**
     * @param {Number} id
     * @param {Number} projectId
     * @return {Promise<ModelDB>}
     */
    static async removeFromProject(id, projectId) {
        return Project.withWriteLock(projectId, [this.modelName], () => {
            return this.#del(id, projectId);
        });
    }

    /**
     * @param { Number } modelId
     * @param { Number? } projectId
     * @returns { Promise<ModelDB> }
     */
    static async #del(modelId, projectId = null) {
        const fileDeleteStack = [];

        const model = await prismaManager.db.$transaction(
            async (tx) => {
                let model = await tx.model.findUnique({
                    where: { id: modelId },
                    include: {
                        projects: projectId !== null,
                        checkpoints: {
                            include: {
                                labels: true,
                            },
                        },
                    },
                });

                if (
                    projectId &&
                    !model.projects.some((m) => m.id === projectId)
                ) {
                    throw new Error("Model is not part of the project.");
                }

                if (projectId && model.projects.length > 1) {
                    await tx.model.update({
                        where: {
                            id: modelId,
                        },
                        data: {
                            projects: {
                                disconnect: { id: projectId },
                            },
                        },
                    });
                } else {
                    await this.withWriteLock(modelId, null, async () => {
                        return tx.model.delete({
                            where: { id: modelId },
                        });
                    });

                    fileDeleteStack.push(
                        ...(await Checkpoint.deleteZombies(
                            model.checkpoints.map((m) => m.id),
                            tx
                        ))
                    );

                    const allPseudoVolumes = [];
                    model.checkpoints.forEach((v) =>
                        allPseudoVolumes.push(...v.labels)
                    );
                    fileDeleteStack.push(
                        ...(await PseudoLabeledVolumeData.deleteZombies(
                            allPseudoVolumes,
                            tx
                        ))
                    );

                    return model;
                }

                return model;
            },
            {
                timeout: 60000,
            }
        );

        for (const file of fileDeleteStack) {
            fsPromises
                .rm(file, { recursive: true, force: true })
                .catch((error) => {
                    console.error(`Failed to delete ${file}: ${error}`);
                });
        }

        return model;
    }

    /**
     * @param {Number[]} ids
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @return {Promise<void>}
     */
    static async deleteZombies(ids, tx) {
        if (ids.length === 0) {
            return;
        }

        const models = await tx.model.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    projects: {
                        none: {},
                    },
                },
            },
        });

        const idsToDelete = models.map((m) => m.id);

        await this.withWriteLocks(idsToDelete, null, async () => {
            return tx.model.deleteMany({
                where: {
                    id: {
                        in: idsToDelete,
                    },
                },
            });
        });
    }
}
