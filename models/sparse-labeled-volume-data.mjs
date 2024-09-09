// @ts-check

import { VolumeData } from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "fs/promises";
import path from "path";
import fileUpload from "express-fileupload";

/**
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @extends {VolumeData}
 */
export class SparseLabeledVolumeData extends VolumeData {
    /**
     * @return {String}
     */
    static get modelName() {
        return "sparseLabelVolumeData";
    }

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
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async create(ownerId, volumeId) {
        return await super.create(ownerId, volumeId);
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
                },
            },
        });
        await tx.sparseLabelVolumeData.deleteMany({
            where: {
                id: {
                    in: sparseVolumes.map((v) => v.id),
                },
            },
        });
        const fileDeleteStack = [];
        sparseVolumes.forEach((v) =>
            fileDeleteStack.push(...this.getFilePaths(v))
        );

        return fileDeleteStack;
    }

    /**
     * @param {Number} id
     * @param {Number} volumeId
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async removeFromVolume(id, volumeId) {
        return super.removeFromVolume(id, volumeId);
    }

    /**
     * @param {Number} id
     * @param {fileUpload.UploadedFile[]} files
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async uploadFiles(id, files, preventRawFileOverride = false) {
        return super.uploadFiles(id, files, preventRawFileOverride);
    }

    /**
     * @param {String} filePath
     * @param {Number} ownerId
     * @param {Number} volumeId
     * @param {String} settings
     * @param {import("@prisma/client").Prisma.TransactionClient} tx
     * @return {Promise<SparseLabelVolumeDataDB>}
     */
    static async fromRawFile(
        filePath,
        ownerId,
        volumeId,
        settings,
        tx = prismaManager.db
    ) {
        let sparseVolume = await tx.sparseLabelVolumeData.create({
            data: {
                ownerId: ownerId,
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
