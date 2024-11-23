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
     * @param {Number} id
     * @return {Promise<ResultFileDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {String} name
     * @param {String} rawFileName
     * @param {String} settingsFileName
     * @param {Number} index
     * @param {Number} resultId
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
     * @param {Number} id
     * @returns {Promise<ResultFileDB>}
     */
    static async del(id) {
        throw new Error(
            "Result File cannot be deleted manually. Delete Result instead."
        );
    }
}
