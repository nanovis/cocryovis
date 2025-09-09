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
    static lockManager = new WriteLockManager(this.modelName);

    static get db() {
        return prismaManager.db.sparseLabelVolumeData;
    }

    static get folderPath() {
        return "sparse-labeled-volume-data";
    }

    /**
     * @param {number} id
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
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
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async del(id) {
        return await super.del(id);
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
        let sparseVolume = await tx.sparseLabelVolumeData.create({
            data: {
                creatorId: creatorId,
                volumeId,
                ...SparseLabeledVolumeData.fromSettingSchema(settings),
            },
        });

        const folderPath = await this.createVolumeDataFolder(sparseVolume.id);
        const fileName = path.basename(filePath);
        const newFilePath = path.join(folderPath, fileName);
        await fsPromises.rename(filePath, newFilePath);

        try {
            sparseVolume = await tx.sparseLabelVolumeData.update({
                where: { id: sparseVolume.id },
                data: {
                    path: folderPath,
                    rawFilePath: newFilePath,
                },
            });
        } catch (error) {
            try {
                await this.deleteVolumeDataFiles(sparseVolume);
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
     * @returns {Promise<SparseLabelVolumeDataDB>}
     */
    static async setRawData(id, file) {
        /** @type any */
        const rawData = await super.setRawData(id, file);
        return rawData;
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
                        await SparseLabeledVolumeData.getById(labelId);

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
                            volumeData.rawFilePath
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
