// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";

/**
 * @typedef { import("@prisma/client").ResultFile } ResultFileDB
 */

export default class ResultFile extends DatabaseModel {
    static modelName = "resultFile";

    static get db() {
        return prismaManager.db.resultFile;
    }

    /**
     * @param {number} id
     * @returns {Promise<ResultFileDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {string} name
     * @param {string} rawFileName
     * @param {string} settingsFileName
     * @param {number} index
     * @param {number} resultId
     * @param {import("@prisma/client").Prisma.TransactionClient} client
     * @returns {Promise<ResultFileDB>}
     */
    static async create(
        name,
        rawFileName,
        settingsFileName,
        index,
        resultId,
        client = prismaManager.db
    ) {
        return await client.resultFile.create({
            data: {
                name: name,
                rawFileName: rawFileName,
                settingsFileName: settingsFileName,
                index: index,
                resultId: resultId,
            },
        });
    }

    /**
     * @param {number} _id
     * @returns {Promise<ResultFileDB>}
     */
    static async del(_id) {
        throw new Error(
            "Result File cannot be deleted manually. Delete Result instead."
        );
    }
}
