// @ts-check

import VolumeData from "./volume-data.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import fsPromises from "fs/promises";
import path from "path";
import WriteLockManager from "../tools/write-lock-manager.mjs";

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
     * @param {number} volumeDataId
     * @returns {Promise<PseudoVolumeDataDB>}
     */
    static async del(volumeDataId) {
        const fileDeleteStack = [];

        const volumeData = await prismaManager.db.$transaction(
            async (tx) => {
                const volumeData = await tx.pseudoLabelVolumeData.delete({
                    where: { id: volumeDataId },
                });

                await this.deleteVolumeDataFiles(volumeData);
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
                volumeId,
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
