// @ts-check

import VolumeData from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "fs/promises";
import path from "path";
import fileUpload from "express-fileupload";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @extends {VolumeData}
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
     * @param {Number} id
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} creatorId
     * @param {Number} volumeId
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async create(creatorId, volumeId) {
        return await super.create(creatorId, volumeId);
    }

    /**
     * @param {Number} creatorId
     * @param {Number} volumeId
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async createFromFiles(creatorId, volumeId, files) {
        return await super.createFromFiles(creatorId, volumeId, files);
    }

    /**
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.SparseLabelVolumeDataUpdateInput} changes
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async del(id) {
        return await super.del(id);
    }

    /**
     * @param {Number[]} ids
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @return {Promise<String[]>}
     */
    static async deleteZombies(ids, tx) {
        if (ids.length === 0) {
            return [];
        }

        const sparseVolumes = await tx.sparseLabelVolumeData.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    volumes: {
                        none: {},
                    },
                    derivedLabels: {
                        none: {},
                    },
                },
            },
        });

        if (sparseVolumes.length === 0) {
            return [];
        }

        const idsToDelete = sparseVolumes.map((v) => v.id);

        return this.withWriteLocks(idsToDelete, null, async () => {
            await tx.sparseLabelVolumeData.deleteMany({
                where: {
                    id: {
                        in: idsToDelete,
                    },
                },
            });

            /** @type {String[]} */
            const fileDeleteStack = [];

            sparseVolumes.forEach((v) =>
                fileDeleteStack.push(...this.getFilePaths(v))
            );

            return fileDeleteStack;
        });
    }

    /**
     * @param {Number} id
     * @param {Number} volumeId
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async removeFromVolume(id, volumeId) {
        return Volume.withWriteLock(volumeId, [this.modelName], () => {
            return prismaManager.db.$transaction(
                async (tx) => {
                    let volumeData = await tx.sparseLabelVolumeData.findUnique({
                        where: { id: id },
                        include: {
                            volumes: true,
                            derivedLabels: true,
                        },
                    });

                    if (!volumeData.volumes.some((m) => m.id === volumeId)) {
                        throw new ApiError(
                            400,
                            "Volume Data is not part of the volume."
                        );
                    }

                    if (
                        volumeData.volumes.length > 1 ||
                        volumeData.derivedLabels.length > 0
                    ) {
                        await tx.sparseLabelVolumeData.update({
                            where: {
                                id: id,
                            },
                            data: {
                                volumes: {
                                    disconnect: { id: volumeId },
                                },
                            },
                        });
                    } else {
                        await this.withWriteLock(id, null, () => {
                            return tx.sparseLabelVolumeData.delete({
                                where: { id: id },
                            });
                        });

                        await this.deleteVolumeDataFiles(volumeData);
                    }
                    return volumeData;
                },
                {
                    timeout: 60000,
                }
            );
        });
    }

    /**
     * @param {String} filePath
     * @param {Number} creatorId
     * @param {Number} volumeId
     * @param {String} settings
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @return {Promise<SparseLabelVolumeDataDB>}
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
                volumes: {
                    connect: { id: volumeId },
                },
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
                    settings: settings,
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
}
