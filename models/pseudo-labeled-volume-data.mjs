// @ts-check

import { VolumeData } from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fileUpload from "express-fileupload";

/**
 * @typedef { import("@prisma/client").PseudoLabelVolumeData } PseudoVolumeDataDB
 */

/**
 * @extends {VolumeData}
 */
export class PseudoLabeledVolumeData extends VolumeData {
    /**
     * @return {String}
     */
    static get modelName() {
        return "pseudoLabelVolumeData";
    }

    static get db() {
        return prismaManager.db.pseudoLabelVolumeData;
    }

    static get folderPath() {
        return "pseudo-labeled-volume-data";
    }

    /**
     * @param {Number} id
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async create(ownerId, volumeId) {
        return await super.create(ownerId, volumeId);
    }

    /**
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.PseudoLabelVolumeDataUpdateInput} changes
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async update(id, changes) {
        return await super.update(id, changes);
    }

    /**
     * @param {Number} id
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async del(id) {
        return await super.del(id);
    }

    /**
     * @param {Number} id
     * @param {Number} volumeId
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async removeFromVolume(id, volumeId) {
        return await prismaManager.db.$transaction(
            async (tx) => {
                let volumeData = await tx.pseudoLabelVolumeData.findUnique({
                    where: { id: id },
                    include: {
                        volumes: true,
                        checkpoints: true,
                    },
                });

                if (!volumeData.volumes.some((m) => m.id === volumeId)) {
                    throw new Error("Volume Data is not part of the volume.");
                }

                if (
                    volumeData.volumes.length > 1 ||
                    volumeData.checkpoints.length > 0
                ) {
                    await tx.pseudoLabelVolumeData.update({
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
                    await tx.pseudoLabelVolumeData.delete({
                        where: { id: id },
                    });
                    await this.deleteVolumeDataFiles(volumeData);
                }
                return volumeData;
            },
            {
                timeout: 60000,
            }
        );
    }

    /**
     * @param {Number} id
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<PseudoVolumeDataDB>}
     */
    static async uploadFiles(id, files) {
        return await super.uploadFiles(id, files, true);
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
        const fileDeleteStack = [];

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
        await tx.pseudoLabelVolumeData.deleteMany({
            where: {
                id: {
                    in: pseudoVolumes.map((v) => v.id),
                },
            },
        });
        pseudoVolumes.forEach((v) =>
            fileDeleteStack.push(...this.getFilePaths(v))
        );

        return fileDeleteStack;
    }
}
