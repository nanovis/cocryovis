// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import SparseLabeledVolumeData from "./sparse-labeled-volume-data.mjs";
import PseudoLabeledVolumeData from "./pseudo-labeled-volume-data.mjs";
import fsPromises from "fs/promises";
import appConfig from "../tools/config.mjs";
import Utils from "../tools/utils.mjs";
import path from "path";
import { annotationsToVolume } from "../tools/annotations-to-volume.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Project from "./project.mjs";
import { ApiError, MissingResourceError } from "../tools/error-handler.mjs";
import VolumeData from "./volume-data.mjs";

/**
 * @import z from "zod"
 * @import { volumeQuerySchema } from "#schemas/volume-path-schema.mjs"
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoLabelVolumeDataDB
 */

export default class Volume extends DatabaseModel {
    static modelName = "volume";
    static lockManager = new WriteLockManager(this.modelName);
    static annotationsTempDirectory = path.join(
        appConfig.tempPath,
        "annotations"
    );

    static get db() {
        return prismaManager.db.volume;
    }

    /**
     * @param {number} id
     * @param {z.infer<volumeQuerySchema>} options
     */
    static async getById(
        id,
        options = {
            rawData: false,
            sparseVolumes: false,
            pseudoVolumes: false,
            results: false,
            project: false,
        }
    ) {
        const entry = await this.db.findUnique({
            where: { id: id },
            include: {
                rawData: options.rawData,
                sparseVolumes: options.sparseVolumes,
                pseudoVolumes: options.pseudoVolumes,
                results: options.results,
                project: options.project,
            },
        });
        if (entry === null) {
            throw MissingResourceError.fromId(id, this.modelName);
        }
        return entry;
    }

    /**
     * @param {number} projectId
     * @param {z.infer<volumeQuerySchema>} options
     */
    static async getVolumesFromProject(
        projectId,
        options = {
            rawData: false,
            sparseVolumes: false,
            pseudoVolumes: false,
            results: false,
            project: false,
        }
    ) {
        return await this.db.findMany({
            where: {
                project: {
                    id: projectId,
                },
            },
            include: {
                rawData: options.rawData,
                sparseVolumes: options.sparseVolumes,
                pseudoVolumes: options.pseudoVolumes,
                results: options.results,
                project: options.project,
            },
        });
    }

    /**
     * @param {number} projectId
     */
    static async getVolumesFromProjectDeep(projectId) {
        return await this.db.findMany({
            where: {
                project: {
                    id: projectId,
                },
            },
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
        });
    }

    /**
     * @param {number[]} ids
     * @returns {Promise<VolumeDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
    }

    /**
     * @param {number[]} ids
     * @param {object} options
     * @param {boolean} [options.rawData]
     * @param {boolean} [options.sparseVolumes]
     * @param {boolean} [options.pseudoVolumes]
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
     * @param {string} name
     * @param {string} description
     * @param {number} creatorId
     * @param {number} projectId
     * @returns {Promise<VolumeDB>}
     */
    static async create(name, description, creatorId, projectId) {
        return Project.withWriteLock(projectId, [this.modelName], () => {
            return this.db.create({
                data: {
                    name: name,
                    description: description,
                    creatorId: creatorId,
                    projectId,
                },
            });
        });
    }

    /**
     * @param {number} sourceId
     * @param {number} creatorId
     * @param {number} projectId
     * @returns {Promise<VolumeDB>}
     */
    // static async clone(sourceId, creatorId, projectId) {
    //     return await prismaManager.db.$transaction(async (tx) => {
    //         return this.cloneTransaction(tx, sourceId, creatorId, projectId);
    //     });
    // }

    /**
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @param {number} sourceId
     * @param {number} creatorId
     * @param {number?} projectId
     * @returns {Promise<VolumeDB>}
     */
    // static async cloneTransaction(tx, sourceId, creatorId, projectId = null) {
    //     const sourceVolume = await tx.volume.findUnique({
    //         where: { id: sourceId },
    //         include: {
    //             sparseVolumes: {
    //                 select: {
    //                     id: true,
    //                 },
    //             },
    //             pseudoVolumes: {
    //                 select: {
    //                     id: true,
    //                 },
    //             },
    //             results: {
    //                 select: {
    //                     id: true,
    //                 },
    //             },
    //         },
    //     });
    
    //     if (!sourceVolume) {
    //         throw MissingResourceError.fromId(sourceId, this.modelName);
    //     }
    //     //LOL volume needs to have rawvolueDataId
    //     const newVolumeData = {
    //         name: sourceVolume.name,
    //         description: sourceVolume.description,
    //         creatorId: creatorId,
    //         rawDataId: sourceVolume.rawDataId,
    //         projectId: projectId,
    //         sparseVolumes: {
    //             connect: sourceVolume.sparseVolumes,
    //         },
    //         pseudoVolumes: {
    //             connect: sourceVolume.pseudoVolumes,
    //         },
    //         results: {
    //             connect: sourceVolume.results,
    //         },
    //     };

    //     if (projectId != null) {
    //         newVolumeData.projects = {
    //             connect: { id: projectId },
    //         };
    //     }

    //     const newVolume = await tx.volume.create({
    //         data: newVolumeData,
    //     });

    //     return newVolume;
    // }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.VolumeUpdateInput} changes
     * @returns {Promise<VolumeDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} volumeId
     * @returns { Promise<VolumeDB> }
     */
    static async del(volumeId) {
        return await this.withWriteLock(volumeId, null, () => {
            return this.db.delete({
                where: { id: volumeId },
            });
        });

        // const fileDeleteStack = [];

        // const volume = await prismaManager.db.$transaction(
        //     async (tx) => {
        //         const volume = await tx.volume.findUnique({
        //             where: { id: volumeId },
        //             include: {
        //                 project: projectId !== null,
        //                 sparseVolumes: true,
        //                 pseudoVolumes: true,
        //                 results: true,
        //             },
        //         });

        //         if (projectId && volume.project.id !== projectId) {
        //             throw new ApiError(
        //                 400,
        //                 "Volume is not part of the project."
        //             );
        //         }

        //         if (projectId && volume.projects.length > 1) {
        //             await tx.volume.update({
        //                 where: {
        //                     id: volumeId,
        //                 },
        //                 data: {
        //                     projects: {
        //                         disconnect: { id: projectId },
        //                     },
        //                 },
        //             });
        //         }

        //         await this.withWriteLock(volumeId, null, () => {
        //             return tx.volume.delete({
        //                 where: { id: volumeId },
        //             });
        //         });

        //         fileDeleteStack.push(
        //             ...(await Result.deleteZombies(
        //                 volume.results.map((r) => r.id),
        //                 tx
        //             ))
        //         );

        //         if (volume.rawDataId) {
        //             fileDeleteStack.push(
        //                 ...(await RawVolumeData.deleteZombies(
        //                     [volume.rawDataId],
        //                     tx
        //                 ))
        //             );
        //         }

        //         fileDeleteStack.push(
        //             ...(await SparseLabeledVolumeData.deleteZombies(
        //                 volume.sparseVolumes.map((r) => r.id),
        //                 tx
        //             ))
        //         );

        //         fileDeleteStack.push(
        //             ...(await PseudoLabeledVolumeData.deleteZombies(
        //                 volume.pseudoVolumes.map((r) => r.id),
        //                 tx
        //             ))
        //         );

        //         return volume;
        //     },
        //     {
        //         timeout: 60000,
        //     }
        // );

        // for (const file of fileDeleteStack) {
        //     fsPromises
        //         .rm(file, { recursive: true, force: true })
        //         .catch((error) => {
        //             console.error(`Failed to delete ${file}: ${error}`);
        //         });
        // }

        // return volume;
    }

    /**
     * @param {number} id
     * @param {number} creatorId
     * @typedef {object} xyz
     * @property {number} x
     * @property {number} y
     * @property {number} z
     * @param {import("../tools/annotations-to-volume.mjs").AnnotationsEntry[]} annotations
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async addAnnotations(id, creatorId, annotations) {
        let tempFolderPath = null;

        return this.withWriteLock(
            id,
            [SparseLabeledVolumeData.modelName],
            async () => {
                try {
                    tempFolderPath = Utils.createTemporaryFolder(
                        Volume.annotationsTempDirectory
                    );

                    const outputFile =
                        Utils.stripExtension(annotations[0].volumeName) +
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
                                    "Volume already has maximum number of Manual Labels"
                                );
                            }

                            const sparseVolume =
                                await SparseLabeledVolumeData.fromRawFile(
                                    outputPath,
                                    creatorId,
                                    volume.id,
                                    settings,
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
     * @param {string} folderPath
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {SparseLabelVolumeDataDB[]} originalLabels
     * @returns {Promise<PseudoLabelVolumeDataDB[]>}
     */
    static async addPseudoLabelsFromFolder(
        folderPath,
        creatorId,
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
                        "Volume does not have enough space to generate pseudo labels from manual label set."
                    );
                }

                const newFolders = [];
                const files = await fsPromises.readdir(folderPath);

                const newPseudoLabels = [];
                try {
                    for (let i = 0; i < files.length; i++) {
                        const filePath = path.join(folderPath, files[i]);
                        const pseudoLabelVolumeData =
                            await PseudoLabeledVolumeData.fromRawFile(
                                filePath,
                                creatorId,
                                volumeId,
                                originalLabels[i].id,
                                VolumeData.toSettingSchema(originalLabels[i]),
                                tx
                            );
                        newFolders.push(pseudoLabelVolumeData.path);
                        newPseudoLabels.push(pseudoLabelVolumeData);
                    }

                    return newPseudoLabels;
                } catch {
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
