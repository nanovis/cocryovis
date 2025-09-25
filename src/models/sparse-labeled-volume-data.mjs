// @ts-check

import VolumeData from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "fs/promises";
import path from "path";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { PendingLocalFile, PendingUpload } from "../tools/file-handler.mjs";
import Utils from "../tools/utils.mjs";
import { annotationsToVolume } from "../tools/annotations-to-volume.mjs";
import SparseVolumeDataFile from "./sparse-volume-data-file.mjs";
import { Prisma } from "@prisma/client";
import { withTransaction } from "./database-model.mjs";

/**
 * @import z from "zod"
 * @import { volumeSettings } from "#schemas/componentSchemas/volume-settings-schema.mjs";
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @augments {VolumeData}
 */
export default class SparseLabeledVolumeData extends VolumeData {
    static modelName = "sparseLabelVolumeData";
    static fileModelName = "sparseVolumeDataFile";
    static lockManager = new WriteLockManager(this.modelName);
    static fileClass = SparseVolumeDataFile;

    static get db() {
        return prismaManager.db.sparseLabelVolumeData;
    }

    /**
     * @param {number} id
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number} id
     */
    static async getWithData(id) {
        const volumeData = await this.db.findUniqueOrThrow({
            where: { id: id },
            include: {
                dataFile: true,
            },
        });
        return volumeData;
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async create(creatorId, volumeId) {
        return await super.create(creatorId, volumeId);
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {PendingUpload[]} files
     * @param {z.infer<typeof volumeSettings>} settings
     * @param {boolean?} skipLock
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async createFromFiles(
        creatorId,
        volumeId,
        files,
        settings,
        skipLock = false
    ) {
        return await super.createFromFiles(
            creatorId,
            volumeId,
            files,
            settings,
            skipLock
        );
    }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.SparseLabelVolumeDataUpdateInput} changes
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} id
     * @param {Prisma.TransactionClient | undefined} [client]
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async del(id, client) {
        return await withTransaction(client, async (tx) => {
            const VolumeData = await tx.sparseLabelVolumeData.delete({
                where: { id: id },
            });

            const dataFile = await tx.sparseVolumeDataFile.delete({
                where: {
                    id: VolumeData.dataFileId,
                    sparseLabelVolumeData: {
                        none: {},
                    },
                },
            });
            if (dataFile) {
                await SparseVolumeDataFile.removeFilesFromDisc(dataFile);
            }
            return VolumeData;
        });
    }

    /**
     * @param {string} filePath
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {z.infer<typeof volumeSettings>} settings
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async fromRawFile(
        filePath,
        creatorId,
        volumeId,
        settings,
        tx = prismaManager.db
    ) {
        const fileName = path.basename(filePath);
        let sparseVolume = await tx.sparseLabelVolumeData.create({
            data: {
                creator: {
                    connect: {
                        id: creatorId,
                    },
                },
                volume: {
                    connect: {
                        id: volumeId,
                    },
                },
                ...SparseLabeledVolumeData.fromSettingSchema(settings),
                dataFile: {},
                name: Utils.stripExtension(fileName),
            },
        });

        const folderPath = await SparseVolumeDataFile.createVolumeDataFolder(
            sparseVolume.dataFileId
        );
        const newFilePath = path.join(folderPath, fileName);
        await fsPromises.rename(filePath, newFilePath);
        let dataFile = null;
        try {
            dataFile = await tx.sparseVolumeDataFile.update({
                where: { id: sparseVolume.id },
                data: {
                    path: folderPath,
                    rawFilePath: newFilePath,
                },
            });
        } catch (error) {
            try {
                if (dataFile) {
                    await SparseVolumeDataFile.removeFilesFromDisc(dataFile);
                }
            } catch (err) {
                console.error(
                    `Failed to delete volume data folder on failed operation:\n${err}`
                );
            }
            throw error;
        }

        return sparseVolume;
    }

    /**
     * @param {number} id
     * @param {PendingUpload} file
     * @param {Prisma.TransactionClient | undefined} [client]
     */
    static async setRawData(id, file, client) {
        return await withTransaction(client, async (tx) => {
            const volumeData = await tx.sparseLabelVolumeData.findUniqueOrThrow(
                {
                    where: { id: id },
                    include: {
                        dataFile: {
                            include: { sparseLabelVolumeData: true },
                        },
                    },
                }
            );
            if (volumeData.dataFile.sparseLabelVolumeData.length === 1) {
                await SparseVolumeDataFile.updateFromFile(
                    file,
                    volumeData.dataFile,
                    tx
                );
                return volumeData;
            } else {
                const fileData = await SparseVolumeDataFile.createFromFile(
                    file,
                    tx
                );
                return await tx.sparseLabelVolumeData.update({
                    where: { id: id },
                    data: {
                        id: fileData.id,
                    },
                });
            }
        });
    }

    /**
     * @param {number} labelId
     * @param {number} volumeId
     * @param {import("../tools/annotations-to-volume.mjs").AnnotationsEntry[]} annotations
     * @param {boolean} saveAsNew
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async updateAnnotations(
        labelId,
        volumeId,
        annotations,
        saveAsNew = false
    ) {
        let tempFolderPath = null;

        return await this.withWriteLock(
            volumeId,
            [SparseLabeledVolumeData.modelName],
            async () => {
                try {
                    const volumeData =
                        await SparseLabeledVolumeData.getWithData(labelId);
                    const volumeDataSettings =
                        SparseLabeledVolumeData.toSettingSchema(volumeData);

                    tempFolderPath = Utils.createTemporaryFolder(
                        Volume.annotationsTempDirectory
                    );

                    const outputFile =
                        Utils.stripExtension(annotations[0].volumeName) +
                        "_annotated.raw";
                    const outputPath = path.join(tempFolderPath, outputFile);

                    let settings;

                    if (!saveAsNew) {
                        const currentData = await new PendingLocalFile(
                            volumeData.dataFile.rawFilePath
                        ).getData();
                        settings = await annotationsToVolume(
                            annotations,
                            outputPath,
                            currentData
                        );
                    } else {
                        settings = await annotationsToVolume(
                            annotations,
                            outputPath
                        );
                    }

                    if (
                        settings.size.x !== volumeDataSettings.size.x ||
                        settings.size.y !== volumeDataSettings.size.y ||
                        settings.size.z !== volumeDataSettings.size.z
                    ) {
                        throw new ApiError(
                            400,
                            "Annotations dimensions mismatch the volume data dimensions."
                        );
                    }

                    const file = new PendingLocalFile(outputPath);

                    return await SparseLabeledVolumeData.setRawData(
                        labelId,
                        file
                    );
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
}
