// @ts-check

import { PrismaClient, Prisma } from "@prisma/client";

class PrismaManager {
    /**
     * @type {PrismaClient}
     */
    db;

    constructor() {
        this.db = new PrismaClient({
            transactionOptions: {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                maxWait: 5000,
                timeout: 10000,
            },
        });
    }

    /**
     * @returns {PrismaManager}
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = new this();
        }
        return this.instance;
    }
}

const prismaManager = PrismaManager.getInstance();

export default prismaManager;
