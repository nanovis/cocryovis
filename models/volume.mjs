// @ts-check

import { BaseModel } from "./base-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { RawVolumeData } from "./raw-volume-data.mjs";
import { SparseLabeledVolumeData } from "./sparse-labeled-volume-data.mjs";
import { PseudoLabeledVolumeData } from "./pseudo-labeled-volume-data.mjs";
import fsPromises from "fs/promises";
import { Result } from "./result.mjs";

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

    /**
     * @param {Number} id
     * @return {Promise<VolumeDB>}
     */
    static async del(id) {
        return this.#del(id);
    }

    /**
     * @param {Number} id
     * @param {Number} projectId
     * @return {Promise<VolumeDB>}
     */
    static async removeFromProject(id, projectId) {
        return this.#del(id, projectId);
    }

    // @param { import("@prisma/client").Prisma.VolumeDelegate } db

    /**
     * @param { Number } volumeId
     * @param { Number? } projectId
     * @returns { Promise<VolumeDB> }
     */
    static async #del(volumeId, projectId = null) {
        const fileDeleteStack = [];

        const volume = await prismaManager.db.$transaction(
            async (tx) => {
                const volume = await tx.volume.findUnique({
                    where: { id: volumeId },
                    include: {
                        projects: projectId !== null,
                        sparseVolumes: true,
                        pseudoVolumes: true,
                        results: true,
                    },
                });

                if (
                    projectId &&
                    !volume.projects.some((m) => m.id === projectId)
                ) {
                    throw new Error("Volume is not part of the project.");
                }

                if (projectId && volume.projects.length > 1) {
                    await tx.volume.update({
                        where: {
                            id: volumeId,
                        },
                        data: {
                            projects: {
                                disconnect: { id: projectId },
                            },
                        },
                    });
                } else {
                    await tx.volume.delete({
                        where: { id: volumeId },
                    });

                    fileDeleteStack.push(
                        ...(await Result.deleteZombies(
                            volume.results.map((r) => r.id),
                            tx
                        ))
                    );

                    if (volume.rawDataId) {
                        fileDeleteStack.push(
                            ...(await RawVolumeData.deleteZombies(
                                [volume.rawDataId],
                                tx
                            ))
                        );
                    }

                    fileDeleteStack.push(
                        ...(await SparseLabeledVolumeData.deleteZombies(
                            volume.sparseVolumes.map((r) => r.id),
                            tx
                        ))
                    );

                    fileDeleteStack.push(
                        ...(await PseudoLabeledVolumeData.deleteZombies(
                            volume.pseudoVolumes.map((r) => r.id),
                            tx
                        ))
                    );
                }

                return volume;
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

        return volume;
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
        await tx.volume.deleteMany({
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
    }
}
