// @ts-check

import DatabaseModel from "./base-model.mjs";
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

/**
 * @typedef { import("@prisma/client").Volume } VolumeDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

export default class Volume extends DatabaseModel {
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
     * @param {Number[]} ids
     * @return {Promise<VolumeDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
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

    /**
     * @param {Number} id
     * @param {Number} ownerId
     * @typedef {Object} xyz
     * @property {Number} x
     * @property {Number} y
     * @property {Number} z
     * @param {{volumeName: String, dimensions: xyz, kernelSize: xyz, positions: xyz[]}} annotations
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async addAnnotations(id, ownerId, annotations) {
        const tempFolderPath = Utils.createTemporaryFolder(
            appConfig.annotationsCachePath
        );
        try {
            const outputFile =
                path.parse(annotations.volumeName).name + "_annotated.raw";
            const outputPath = path.join(tempFolderPath, outputFile);
            const settings = await annotationsToVolume(
                annotations.dimensions,
                annotations.kernelSize,
                annotations.positions,
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
                        throw new Error(
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
        await prismaManager.db.$transaction(
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
                    throw new Error(
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
