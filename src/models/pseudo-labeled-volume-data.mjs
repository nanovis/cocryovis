// @ts-check

import VolumeData from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import SparseLabeledVolumeData from "./sparse-labeled-volume-data.mjs";
import fsPromises from "fs/promises";
import path from "path";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import Volume from "./volume.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import { PendingUpload } from "../tools/file-handler.mjs";

/**
 * @import z from "zod"
 * @import { volumeSettings } from "#schemas/componentSchemas/volume-settings-schema.mjs";
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoVolumeDataDB
 */

/**
 * @augments {VolumeData}
 */
export default class PseudoLabeledVolumeData extends VolumeData {
    static modelName = "pseudoLabelVolumeData";
    static lockManager = new WriteLockManager(this.modelName);

    static get db() {
        return prismaManager.db.pseudoLabelVolumeData;
    }

    static get folderPath() {
        return "pseudo-labeled-volume-data";
    }

    /**
     * @param {number} id
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number} creatorId
     * @param {number} volumeId
     * @returns {Promise<PseudoVolumeDataDB>}
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
     * @returns {Promise<PseudoVolumeDataDB>}
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
     * @param {import("@prisma/client").Prisma.PseudoLabelVolumeDataUpdateInput} changes
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {number} id
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async del(id) {
        return this.#del(id);
    }

    /**
     * @param {number} id
     * @param {number} volumeId
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async removeFromVolume(id, volumeId) {
        return Volume.withWriteLock(volumeId, null, () => {
            return this.#del(id, volumeId);
        });
    }

    /**
     * @param {number} volumeDataId
     * @param {number?} volumeId
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async #del(volumeDataId, volumeId = null) {
        const fileDeleteStack = [];

        const volumeData = await prismaManager.db.$transaction(
            async (tx) => {
                let volumeData = await tx.pseudoLabelVolumeData.findUnique({
                    where: { id: volumeDataId },
                    include: {
                        volumes: volumeId !== null,
                        checkpoints: true,
                    },
                });

                if (
                    volumeId &&
                    !volumeData.volumes.some((v) => v.id === volumeId)
                ) {
                    throw new ApiError(
                        400,
                        "Volume Data is not part of the volume."
                    );
                }

                if (
                    volumeId &&
                    (volumeData.volumes.length > 1 ||
                        volumeData.checkpoints.length > 0)
                ) {
                    await tx.pseudoLabelVolumeData.update({
                        where: {
                            id: volumeDataId,
                        },
                        data: {
                            volumes: {
                                disconnect: { id: volumeId },
                            },
                        },
                    });
                } else {
                    await this.withWriteLock(volumeDataId, null, () => {
                        return tx.pseudoLabelVolumeData.delete({
                            where: { id: volumeDataId },
                        });
                    });

                    if (volumeData.originalLabelId) {
                        fileDeleteStack.push(
                            ...(await SparseLabeledVolumeData.deleteZombies(
                                [volumeData.originalLabelId],
                                tx
                            ))
                        );
                    }

                    await this.deleteVolumeDataFiles(volumeData);
                }
                return volumeData;
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

        return volumeData;
    }

    /**
     * @param {number[]} ids
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @returns {Promise<string[]>}
     */
    static async deleteZombies(ids, tx) {
        if (ids.length === 0) {
            return [];
        }

        const pseudoVolumes = await tx.pseudoLabelVolumeData.findMany({
            where: {
                AND: {
                    id: {
                        in: ids,
                    },
                    volumes: {
                        none: {},
                    },
                    checkpoints: {
                        none: {},
                    },
                },
            },
        });

        if (pseudoVolumes.length === 0) {
            return [];
        }

        const idsToDelete = pseudoVolumes.map((v) => v.id);

        return this.withWriteLocks(idsToDelete, null, async () => {
            await tx.pseudoLabelVolumeData.deleteMany({
                where: {
                    id: {
                        in: pseudoVolumes.map((v) => v.id),
                    },
                },
            });

            /** @type {string[]} */
            const fileDeleteStack = [];

            pseudoVolumes.forEach((v) =>
                fileDeleteStack.push(...this.getFilePaths(v))
            );

            return fileDeleteStack;
        });
    }

    /**
     * @param {string} filePath
     * @param {number} creatorId
     * @param {number} volumeId
     * @param {number} originalLabelId
     * @param {z.infer<typeof volumeSettings>} settings
     * @param {import("@prisma/client").Prisma.TransactionClient} client
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async fromRawFile(
        filePath,
        creatorId,
        volumeId,
        originalLabelId,
        settings,
        client = prismaManager.db
    ) {
        let pseudoVolume = await client.pseudoLabelVolumeData.create({
            data: {
                creatorId: creatorId,
                originalLabelId: originalLabelId,
                ...PseudoLabeledVolumeData.fromSettingSchema(settings),
                volumes: {
                    connect: { id: volumeId },
                },
            },
        });

        const folderPath = await this.createVolumeDataFolder(pseudoVolume.id);
        const fileName = path.basename(filePath);
        const newFilePath = path.join(folderPath, fileName);
        await fsPromises.rename(filePath, newFilePath);

        try {
            pseudoVolume = await client.pseudoLabelVolumeData.update({
                where: { id: pseudoVolume.id },
                data: {
                    path: folderPath,
                    rawFilePath: newFilePath,
                },
            });
        } catch (error) {
            try {
                await this.deleteVolumeDataFiles(pseudoVolume);
            } catch (err) {
                console.error(
                    `Failed to delete volume data folder on failed operation:\n${err}`
                );
            }
            throw error;
        }

        return pseudoVolume;
    }
}
