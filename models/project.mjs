// @ts-check

import { BaseModel } from "./base-model.mjs";
import { Volume } from "./volume.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import { Model } from "./model.mjs";
import { PseudoLabeledVolumeData } from "./pseudo-labeled-volume-data.mjs";
import { SparseLabeledVolumeData } from "./sparse-labeled-volume-data.mjs";
import { RawVolumeData } from "./raw-volume-data.mjs";
import { Checkpoint } from "./checkpoint.mjs";
import { Result } from "./result.mjs";
import fsPromises from "fs/promises";

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
                        rawData: true,
                        sparseVolumes: true,
                        pseudoVolumes: true,
                        results: true,
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
     * @param {import("@prisma/client").Prisma.ProjectUpdateInput} changes
     * @return {Promise<ProjectDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param { Number } id
     * @returns { Promise<ProjectDB> }
     */
    static async del(id) {
        const fileDeleteStack = [];

        const project = await prismaManager.db.$transaction(
            async (tx) => {
                const project = await tx.project.delete({
                    where: {
                        id: id,
                    },
                    include: {
                        volumes: {
                            where: {
                                projects: {
                                    every: {
                                        id: id,
                                    },
                                },
                            },
                            include: {
                                rawData: true,
                                sparseVolumes: true,
                                pseudoVolumes: true,
                                results: true,
                            },
                        },
                        models: {
                            where: {
                                projects: {
                                    every: {
                                        id: id,
                                    },
                                },
                            },
                            include: {
                                checkpoints: true,
                            },
                        },
                    },
                });

                // await tx.project.delete({
                //     where: {
                //         id: id,
                //     },
                // });

                await Volume.deleteZombies(
                    project.volumes.map((v) => v.id),
                    tx
                );
                await Model.deleteZombies(
                    project.models.map((m) => m.id),
                    tx
                );

                const allResults = [];
                project.volumes.forEach((v) => allResults.push(...v.results));
                fileDeleteStack.push(
                    ...(await Result.deleteZombies(
                        allResults.map((r) => r.id),
                        tx
                    ))
                );

                const allCheckpoints = [];
                project.models.forEach((m) =>
                    allCheckpoints.push(...m.checkpoints)
                );
                fileDeleteStack.push(
                    ...(await Checkpoint.deleteZombies(
                        allCheckpoints.map((c) => c.id),
                        tx
                    ))
                );

                const allRawVolumes = [];
                project.volumes.forEach(
                    (v) => v.rawData && allRawVolumes.push(v.rawData.id)
                );
                fileDeleteStack.push(
                    ...(await RawVolumeData.deleteZombies(allRawVolumes, tx))
                );

                const allSparseVolumes = [];
                project.volumes.forEach((v) =>
                    allSparseVolumes.push(...v.sparseVolumes)
                );
                fileDeleteStack.push(
                    ...(await SparseLabeledVolumeData.deleteZombies(
                        allSparseVolumes.map((v) => v.id),
                        tx
                    ))
                );

                const allPseudoVolumes = [];
                project.volumes.forEach((v) =>
                    allPseudoVolumes.push(...v.pseudoVolumes)
                );
                fileDeleteStack.push(
                    ...(await PseudoLabeledVolumeData.deleteZombies(
                        allPseudoVolumes.map((v) => v.id),
                        tx
                    ))
                );

                return project;
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

        return project;
    }
}
