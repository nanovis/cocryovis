// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "fs/promises";
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";

/**
 * @import z from "zod"
 * @import { volumeQuerySchema } from "#schemas/volume-path-schema.mjs"
 * @typedef { import("@prisma/client").Project } ProjectDB
 * @typedef { import("@prisma/client").ProjectAccess } ProjectAccess
 * @typedef { { volumes?: boolean | { include: z.infer<volumeQuerySchema> }, models?: boolean | { include: { checkpoints: boolean } }, owner?: boolean } } Options
 * @typedef {{userId: number, accessLevel: number}} UserAccessInfo
 */

export default class Project extends DatabaseModel {
    static modelName = "project";

    static get db() {
        return prismaManager.db.project;
    }

    /**
     * @param {number} projectId
     * @param {number} userId
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
        }

        return projectWithAccessLevel;
    }

    /**
     * @param {number} userId
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
     * @param {number} userId
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
     * @param {number} projectId
     * @param {number} userId
     * @returns {Promise<number>}
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
     * @param {number} id
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
     * @param {number} id
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
     * @param {number} id
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
     * @param {number} id
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
     * @param {string} name
     * @param {string} description
     * @param {number} ownerId
     * @returns {Promise<ProjectDB>}
     */
    static async create(name, description, ownerId) {
        return await prismaManager.db.project.create({
            data: { name: name, description: description, ownerId: ownerId },
        });
    }

    /**
     * @param {number} sourceId
     * @param {number} ownerId
     * @returns {Promise<ProjectDB>}
     */
    // static async deepClone(sourceId, ownerId) {
    //     return await prismaManager.db.$transaction(async (tx) => {
    //         const sourceProject = await tx.project.findUnique({
    //             where: { id: sourceId },
    //             include: {
    //                 volumes: {
    //                     select: {
    //                         id: true,
    //                     },
    //                 },
    //                 models: {
    //                     select: {
    //                         id: true,
    //                     },
    //                 },
    //             },
    //         });

    //         if (!sourceProject) {
    //             throw MissingResourceError.fromId(sourceId, this.modelName);
    //         }

    //         const volumes = await Promise.all(
    //             sourceProject.volumes.map(async (v) =>
    //                 Volume.cloneTransaction(tx, v.id, ownerId)
    //             )
    //         );
    //         const models = await Promise.all(
    //             sourceProject.models.map(async (v) =>
    //                 Model.cloneTransaction(tx, v.id, ownerId)
    //             )
    //         );

    //         const newProject = await tx.project.create({
    //             data: {
    //                 name: sourceProject.name,
    //                 description: sourceProject.description,
    //                 ownerId: ownerId,
    //                 volumes: {
    //                     connect: volumes,
    //                 },
    //                 models: {
    //                     connect: models,
    //                 },
    //             },
    //         });

    //         return newProject;
    //     });
    // }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.ProjectUpdateInput} changes
     * @returns {Promise<ProjectDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} id
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
                                    project: {
                                        id: id,
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
                                    project: {
                                        id: id,
                                    },
                                },
                                include: {
                                    checkpoints: true,
                                },
                            },
                        },
                    });
                });

                const allCheckpoints = [];
                project.models.forEach((m) =>
                    allCheckpoints.push(...m.checkpoints)
                );
                const allRawVolumes = [];
                project.volumes.forEach(
                    (v) => v.rawData && allRawVolumes.push(v.rawData.id)
                );

                const allSparseVolumes = [];
                project.volumes.forEach((v) =>
                    allSparseVolumes.push(...v.sparseVolumes)
                );

                const allPseudoVolumes = [];
                project.volumes.forEach((v) =>
                    allPseudoVolumes.push(...v.pseudoVolumes)
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
