// @ts-check

import DatabaseModel from "./database-model.mjs";
import Volume from "./volume.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import Model from "./model.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import SparseLabeledVolumeData from "./sparse-labeled-volume-data.mjs";
import RawVolumeData from "./raw-volume-data.mjs";
import Checkpoint from "./checkpoint.mjs";
import Result from "./result.mjs";
import fsPromises from "fs/promises";
import { MissingResourceError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").Project } ProjectDB
 * @typedef { import("@prisma/client").ProjectAccess } ProjectAccess
 * @typedef { { volumes?: boolean, models?: boolean | { include: { checkpoints: boolean } }, owner?: boolean } } Options
 * @typedef { {userId: Number, accessLevel: Number} } AccessInfo
 */

export default class Project extends DatabaseModel {
    static modelName = "project";

    static get db() {
        return prismaManager.db.project;
    }

    /**
     * @param {Number} userId
     * @param {Options} options
     */
    static async getUserProjects(
        userId,
        { volumes = false, models = false, owner = false } = {}
    ) {
        return await this.db.findMany({
            where: {
                OR: [
                    {
                        ownerId: userId,
                    },
                    {
                        projectAccess: {
                            some: {
                                userId: userId,
                            },
                        },
                    },
                ],
            },
            include: {
                volumes: volumes,
                models: models,
                owner: owner,
                projectAccess: {
                    where: {
                        userId: userId,
                    },
                },
            },
        });
    }

    /**
     * @param {Number} id
     * @returns {Promise<AccessInfo[]>}
     */
    static async getAccessInfo(id) {
        const projectAccess = await prismaManager.db.projectAccess.findMany({
            where: {
                projectId: id,
            },
            select: {
                userId: true,
                accessLevel: true,
            },
        });
        return projectAccess;
    }

    /**
     * @param {Number} id
     * @param {AccessInfo[]} accessInfo
     * @returns {Promise<{updated: AccessInfo[], deleted: AccessInfo[]}>}
     */
    static async setAccess(id, accessInfo) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                const project = await tx.project.findUnique({
                    where: { id: id },
                });

                accessInfo = accessInfo.filter(
                    (info) => info.userId !== project.ownerId
                );

                if (accessInfo.length === 0) {
                    return;
                }

                const updatedAccessInstances = [];
                const deletedAccessInstances = [];
                for (const accessInstance of accessInfo) {
                    if (accessInstance.accessLevel < 0) {
                        const deletedAccessInstance =
                            await tx.projectAccess.delete({
                                where: {
                                    userId_projectId: {
                                        userId: accessInstance.userId,
                                        projectId: project.id,
                                    },
                                },
                                select: {
                                    userId: true,
                                    accessLevel: true,
                                },
                            });
                        deletedAccessInstances.push(deletedAccessInstance);
                    } else {
                        const updatedAccessInstance =
                            await tx.projectAccess.upsert({
                                where: {
                                    userId_projectId: {
                                        userId: accessInstance.userId,
                                        projectId: project.id,
                                    },
                                },
                                update: {
                                    accessLevel: accessInstance.accessLevel,
                                },
                                create: {
                                    projectId: project.id,
                                    userId: accessInstance.userId,
                                    accessLevel: accessInstance.accessLevel,
                                },
                                select: {
                                    userId: true,
                                    accessLevel: true,
                                },
                            });
                        updatedAccessInstances.push(updatedAccessInstance);
                    }
                }
                return {
                    updated: updatedAccessInstances,
                    deleted: deletedAccessInstances,
                };
            },
            {
                timeout: 60000,
            }
        );
    }

    /**
     * @param {Number} id
     * @param {Options} options
     */
    static async getById(
        id,
        { volumes = false, models = false, owner = false } = {}
    ) {
        const entry = await this.db.findUnique({
            where: { id: id },
            include: {
                volumes: volumes,
                models: models,
                owner: owner,
            },
        });
        if (entry === null) {
            throw MissingResourceError.fromId(id, this.modelName);
        }
        return entry;
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
     * @param {Number} sourceId
     * @param {Number} ownerId
     * @return {Promise<ProjectDB>}
     */
    static async deepClone(sourceId, ownerId) {
        return await prismaManager.db.$transaction(async (tx) => {
            const sourceProject = await tx.project.findUnique({
                where: { id: sourceId },
                include: {
                    volumes: {
                        select: {
                            id: true,
                        },
                    },
                    models: {
                        select: {
                            id: true,
                        },
                    },
                },
            });

            if (!sourceProject) {
                throw MissingResourceError.fromId(sourceId, this.modelName);
            }

            const volumes = await Promise.all(
                sourceProject.volumes.map(async (v) =>
                    Volume.cloneTransaction(tx, v.id, ownerId)
                )
            );
            const models = await Promise.all(
                sourceProject.models.map(async (v) =>
                    Model.cloneTransaction(tx, v.id, ownerId)
                )
            );

            const newProject = await tx.project.create({
                data: {
                    name: sourceProject.name,
                    description: sourceProject.description,
                    ownerId: ownerId,
                    volumes: {
                        connect: volumes,
                    },
                    models: {
                        connect: models,
                    },
                },
            });

            return newProject;
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
                const project = await this.withWriteLock(id, null, () => {
                    return tx.project.delete({
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
                });

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
