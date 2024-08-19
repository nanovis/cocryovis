// @ts-check

import { PrismaClient } from "@prisma/client";

class PrismaManager {
    /**
     * @type {PrismaClient}
     */
    db;

    constructor() {
        this.db = new PrismaClient();
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
