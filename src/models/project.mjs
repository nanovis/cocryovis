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
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").Project } ProjectDB
 * @typedef { import("@prisma/client").ProjectAccess } ProjectAccess
 * @typedef { { volumes?: boolean | { include: import("./volume.mjs").Options }, models?: boolean | { include: { checkpoints: boolean } }, owner?: boolean } } Options
 * @typedef { {userId: Number, accessLevel: Number} } UserAccessInfo
 */

export default class Project extends DatabaseModel {
    static modelName = "project";

    static get db() {
        return prismaManager.db.project;
    }

    /**
     * @param {Number} projectId
     * @param {Number} userId
     */
    static async getByIdDeep(projectId, userId = -1) {
        const project = await this.db.findUnique({
            where: {
                id: projectId,
            },
            include: {
                volumes: {
                    include: {
                        rawData: true,
                        sparseVolumes: true,
                        pseudoVolumes: true,
                        results: {
                            include: {
                                checkpoint: true,
                            },
                        },
                    },
                },
                models: {
                    include: {
                        checkpoints: true,
                    },
                },
                projectAccess: {
                    where: {
                        userId: userId,
                    },
                },
            },
        });

        if (!project) {
            throw ApiError.fromId(projectId, this.modelName);
        }

        let projectWithAccessLevel = { ...project, accessLevel: -1 };

        if (project.ownerId === userId) {
            projectWithAccessLevel.accessLevel = 2;
        } else if (project.projectAccess.length > 0) {
            projectWithAccessLevel.accessLevel =
                project.projectAccess[0].accessLevel;
        } else if (project.publicAccess === 1) {
            projectWithAccessLevel.accessLevel = 0;
        } else {
            throw new ApiError(403, "Access denied");
        }

        return projectWithAccessLevel;
    }

    /**
     * @param {Number} userId
     * @param {Options} options
     */
    static async getUserProjects(
        userId,
        { volumes = false, models = false, owner = false } = {}
    ) {
        const projects = await this.db.findMany({
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

        return projects.map(({ projectAccess, ...project }) => {
            let updatedProject = { ...project, accessLevel: -1 };

            if (project.ownerId === userId) {
                updatedProject.accessLevel = 2;
            } else if (projectAccess.length > 0) {
                updatedProject.accessLevel = projectAccess[0].accessLevel;
            }

            return updatedProject;
        });
    }

    /**
     * @param {Number} userId
     */
    static async getUserProjectsDeep(userId) {
        const projects = await this.db.findMany({
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
                volumes: {
                    include: {
                        rawData: true,
                        sparseVolumes: true,
                        pseudoVolumes: true,
                        results: {
                            include: {
                                checkpoint: true,
                            },
                        },
                    },
                },
                models: {
                    include: {
                        checkpoints: true,
                    },
                },
                projectAccess: {
                    where: {
                        userId: userId,
                    },
                },
            },
        });

        return projects.map(({ projectAccess, ...project }) => {
            let updatedProject = { ...project, accessLevel: -1 };

            if (project.ownerId === userId) {
                updatedProject.accessLevel = 2;
            } else if (projectAccess.length > 0) {
                updatedProject.accessLevel = projectAccess[0].accessLevel;
            }

            return updatedProject;
        });
    }

    /**
     * @param {Number} projectId
     * @param {Number} userId
     * @returns {Promise<Number>}
     */
    static async getUserAccessInfo(projectId, userId) {
        const projectAccess = await prismaManager.db.projectAccess.findUnique({
            where: {
                userId_projectId: {
                    userId: userId,
                    projectId: projectId,
                },
            },
        });
        return projectAccess?.accessLevel ?? -1;
    }

    /**
     * @param {Number} id
     * @returns {Promise<{projectAccess: {ownerId: number, publicAccess: number}, userAccess: UserAccessInfo[]}>}
     */
    static async getAccessInfo(id) {
        const userAccess = await this.getProjectUsersAccessInfo(id);
        const projectAccess = await prismaManager.db.project.findUnique({
            where: { id: id },
            select: {
                ownerId: true,
                publicAccess: true,
            },
        });
        return { projectAccess: projectAccess, userAccess: userAccess };
    }

    /**
     * @param {Number} id
     * @returns {Promise<UserAccessInfo[]>}
     */
    static async getProjectUsersAccessInfo(id) {
        const userAccess = await prismaManager.db.projectAccess.findMany({
            where: {
                projectId: id,
            },
            select: {
                userId: true,
                accessLevel: true,
            },
        });
        return userAccess;
    }

    /**
     * @param {Number} id
     * @param {{publicAccess: number, userAccess: Array<UserAccessInfo>}} accessInfo
     * @returns {Promise<{publicAccess: number, userAccess: UserAccessInfo[]}>}
     */
    static async setAccess(id, accessInfo) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                let project = await tx.project.findUnique({
                    where: { id: id },
                });

                if (!project) {
                    throw ApiError.fromId(id, this.modelName);
                }

                accessInfo.userAccess = accessInfo.userAccess.filter(
                    (info) => info.userId !== project.ownerId
                );

                if (
                    accessInfo.publicAccess !== undefined &&
                    accessInfo.publicAccess !== project.publicAccess
                ) {
                    project = await tx.project.update({
                        where: { id: id },
                        data: {
                            publicAccess: accessInfo.publicAccess,
                        },
                    });
                }

                for (const accessInstance of accessInfo.userAccess) {
                    if (accessInstance.accessLevel < 0) {
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
                    } else {
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
                    }
                }

                const userAccess = await tx.projectAccess.findMany({
                    where: {
                        projectId: id,
                    },
                    select: {
                        userId: true,
                        accessLevel: true,
                    },
                });

                return {
                    publicAccess: project.publicAccess,
                    userAccess: userAccess,
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
