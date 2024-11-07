// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import RawVolumeData from "./raw-volume-data.mjs";
import SparseLabeledVolumeData from "./sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import fsPromises from "fs/promises";
import Result from "./result.mjs";
import appConfig from "../tools/config.mjs";
import Utils from "../tools/utils.mjs";
import path from "path";
import { annotationsToVolume } from "../tools/annotations-to-volume.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Project from "./project.mjs";
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef {{rawData?: boolean, sparseVolumes?: boolean, pseudoVolumes?: boolean, results?: boolean, projects?: boolean }} Options
 */

export default class Volume extends DatabaseModel {
    static modelName = "volume";
    static lockManager = new WriteLockManager(this.modelName);

    static get db() {
        return prismaManager.db.volume;
    }

    /**
     * @param {Number} id
     * @param {Options} options
     */
    static async getById(
        id,
        {
            rawData = false,
            sparseVolumes = false,
            pseudoVolumes = false,
            results = false,
            projects = false,
        } = {}
    ) {
        const entry = await this.db.findUnique({
            where: { id: id },
            include: {
                rawData: rawData,
                sparseVolumes: sparseVolumes,
                pseudoVolumes: pseudoVolumes,
                results: results,
                projects: projects,
            },
        });
        if (entry === null) {
            throw MissingResourceError.fromId(id, this.modelName);
        }
        return entry;
    }

    /**
     * @param {Number} projectId
     * @param {Options} options
     */
    static async getVolumesFromProject(
        projectId,
        {
            rawData = false,
            sparseVolumes = false,
            pseudoVolumes = false,
            results = false,
            projects = false,
        } = {}
    ) {
        return await this.db.findMany({
            where: {
                projects: {
                    some: {
                        id: projectId,
                    },
                },
            },
            include: {
                rawData: rawData,
                sparseVolumes: sparseVolumes,
                pseudoVolumes: pseudoVolumes,
                results: results,
                projects: projects,
            },
        });
    }

    /**
     * @param {Number[]} ids
     * @return {Promise<VolumeDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
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
     * @param {String} name
     * @param {String} description
     * @param {Number} ownerId
     * @param {Number} projectId
     * @return {Promise<VolumeDB>}
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
     * @param {Number} sourceId
     * @param {Number} ownerId
     * @param {Number} projectId
     * @return {Promise<VolumeDB>}
     */
    static async clone(sourceId, ownerId, projectId) {
        return await prismaManager.db.$transaction(async (tx) => {
            return this.cloneTransaction(tx, sourceId, ownerId, projectId);
        });
    }

    /**
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @param {Number} sourceId
     * @param {Number} ownerId
     * @param {Number?} projectId
     * @return {Promise<VolumeDB>}
     */
    static async cloneTransaction(tx, sourceId, ownerId, projectId = null) {
        const sourceVolume = await tx.volume.findUnique({
            where: { id: sourceId },
            include: {
                sparseVolumes: {
                    select: {
                        id: true,
                    },
                },
                pseudoVolumes: {
                    select: {
                        id: true,
                    },
                },
                results: {
                    select: {
                        id: true,
                    },
                },
            },
        });

        if (!sourceVolume) {
            throw MissingResourceError.fromId(sourceId, this.modelName);
        }

        const newVolumeData = {
            name: sourceVolume.name,
            description: sourceVolume.description,
            ownerId: ownerId,
            rawDataId: sourceVolume.rawDataId,
            sparseVolumes: {
                connect: sourceVolume.sparseVolumes,
            },
            pseudoVolumes: {
                connect: sourceVolume.pseudoVolumes,
            },
            results: {
                connect: sourceVolume.results,
            },
        };

        if (projectId != null) {
            newVolumeData.projects = {
                connect: { id: projectId },
            };
        }

        const newVolume = await tx.volume.create({
            data: newVolumeData,
        });

        return newVolume;
    }

    /**
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.VolumeUpdateInput} changes
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
        return Project.withWriteLock(projectId, [this.modelName], () => {
            return this.#del(id, projectId);
        });
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
                    throw new ApiError(
                        400,
                        "Volume is not part of the project."
                    );
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
                    await this.withWriteLock(volumeId, null, () => {
                        return tx.volume.delete({
                            where: { id: volumeId },
                        });
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

        const volumes = await tx.volume.findMany({
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

        if (volumes.length === 0) {
            return;
        }

        const idsToDelete = volumes.map((v) => v.id);

        await this.withWriteLocks(idsToDelete, null, async () => {
            return tx.volume.deleteMany({
                where: {
                    id: {
                        in: idsToDelete,
                    },
                },
            });
        });
    }

    /**
     * @param {Number} id
     * @param {Number} ownerId
     * @typedef {Object} xyz
     * @property {Number} x
     * @property {Number} y
     * @property {Number} z
     * @param {import("../tools/annotations-to-volume.mjs").AnnotationsEntry[]} annotations
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async addAnnotations(id, ownerId, annotations) {
        let tempFolderPath = null;

        return this.withWriteLock(
            id,
            [SparseLabeledVolumeData.modelName],
            async () => {
                try {
                    tempFolderPath = Utils.createTemporaryFolder(
                        appConfig.annotationsCachePath
                    );

                    const outputFile =
                        path.parse(annotations[0].volumeName).name +
                        "_annotated.raw";
                    const outputPath = path.join(tempFolderPath, outputFile);
                    const settings = await annotationsToVolume(
                        annotations,
                        outputPath
                    );

                    const sparseVolume = await prismaManager.db.$transaction(
                        async (tx) => {
                            const volume = await tx.volume.findUnique({
                                where: { id: id },
                                include: {
                                    sparseVolumes: true,
                                },
                            });

                            if (
                                volume.sparseVolumes.length >=
                                appConfig.maxVolumeChannels
                            ) {
                                throw new ApiError(
                                    400,
                                    "Volume already has maximum number of Sparse Labels"
                                );
                            }

                            const sparseVolume =
                                await SparseLabeledVolumeData.fromRawFile(
                                    outputPath,
                                    ownerId,
                                    volume.id,
                                    JSON.stringify(settings),
                                    tx
                                );

                            return sparseVolume;
                        },
                        {
                            timeout: 60000,
                        }
                    );

                    return sparseVolume;
                } finally {
                    if (tempFolderPath !== null) {
                        try {
                            await fsPromises.rm(tempFolderPath, {
                                force: true,
                                recursive: true,
                            });
                        } catch {
                            console.error(
                                `Failed to remove temporary folder: ${tempFolderPath}`
                            );
                        }
                    }
                }
            }
        );
    }

    /**
     * @param {String} folderPath
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @param {SparseLabelVolumeDataDB[]} originalLabels
     * @returns {Promise<void>}
     */
    static async addPseudoLabelsFromFolder(
        folderPath,
        ownerId,
        volumeId,
        originalLabels
    ) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                const volume = await tx.volume.findUnique({
                    where: { id: volumeId },
                    include: {
                        sparseVolumes: true,
                        pseudoVolumes: true,
                    },
                });

                if (
                    volume.sparseVolumes.length + volume.pseudoVolumes.length >
                    appConfig.maxVolumeChannels
                ) {
                    throw new ApiError(
                        400,
                        "Volume does not have enough space to generate pseudo labels from sparse label set."
                    );
                }

                const newFolders = [];
                const files = await fsPromises.readdir(folderPath);
                try {
                    for (let i = 0; i < files.length; i++) {
                        const filePath = path.join(folderPath, files[i]);
                        const settingsJSON = JSON.parse(
                            originalLabels[i].settings
                        );
                        settingsJSON.file = files[i];
                        const settings = JSON.stringify(settingsJSON);
                        const pseudoLabelVolumeData =
                            await PseudoLabeledVolumeData.fromRawFile(
                                filePath,
                                ownerId,
                                volumeId,
                                originalLabels[i].id,
                                settings,
                                tx
                            );
                        newFolders.push(pseudoLabelVolumeData.path);
                    }
                } catch (error) {
                    newFolders.forEach((folder) => {
                        try {
                            fsPromises.rm(folder, {
                                recursive: true,
                                force: true,
                            });
                        } catch (error) {
                            console.log(error);
                        }
                    });
                }
            },
            {
                timeout: 60000,
            }
        );
    }
}
