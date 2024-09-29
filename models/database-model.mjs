// @ts-check

import { Prisma } from "@prisma/client";

import WriteLockManager, {
    WriteMultiLock,
} from "../tools/write-lock-manager.mjs";
import { MissingResourceError } from "../tools/error-handler.mjs";

export default class DatabaseModel {
    /**
     * @constant
     * @type {string}
     */
    static modelName = "";
    /** @type {WriteLockManager?} */ static lockManager = null;

    /**
     * @return {any}
     */
    static get db() {
        throw new Error("Method not implemented");
    }

    /**
     * @param {Number} id
     * @return {Promise<Object>}
     */
    static async getById(id) {
        const entry = await this.db.findUniqueOrThrow({
            where: { id: id },
        });
        if (entry === null) {
            throw MissingResourceError.fromId(id, this.modelName);
        }
        return entry;
    }

    /**
     * @param {Number[]} ids
     * @return {Promise<Object[]>}
     */
    static async getByIds(ids) {
        if (ids.length === 0) {
            return [];
        }
        const entries = await this.db.findMany({
            where: {
                id: {
                    in: ids,
                },
            },
        });
        return entries;
    }

    /**
     * @param {...*} var_args
     * @return {Promise<Object>}
     */
    static async create(...var_args) {
        throw new Error("Method not implemented");
    }

    /**
     * @param {Number} id
     * @param {Object} changes
     * @return {Promise<Object>}
     */
    static async update(id, changes) {
        return this.withWriteLock(id, null, () => {
            try {
                return this.db.update({
                    where: { id: id },
                    data: changes,
                });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    throw MissingResourceError.fromId(id, this.modelName);
                }
                throw error;
            }
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<Object>}
     */
    static async del(id) {
        return this.withWriteLock(id, null, () => {
            try {
                return this.db.delete({
                    where: { id: id },
                });
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    throw MissingResourceError.fromId(id, this.modelName);
                }
                throw error;
            }
        });
    }

    /**
     * @template T
     * @param {Number} id
     * @param {String[]?} connections
     * @param {() => T} operation
     * @returns {Promise<T>}
     */
    static async withWriteLock(id, connections, operation) {
        if (this.lockManager === null) return await operation();

        const lockInstance = this.lockManager.requestLock(id, connections);

        try {
            return await operation();
        } finally {
            lockInstance.removeLock();
        }
    }

    /**
     * @template T
     * @param {Number[]} ids
     * @param {String[]?} connections
     * @param {() => T} operation
     * @returns {Promise<T>}
     */
    static async withWriteLocks(ids, connections, operation) {
        if (this.lockManager === null || ids.length === 0)
            return await operation();

        const locks = ids.map((id) =>
            this.lockManager.generateLockInstance(id, connections)
        );

        const multiLock = new WriteMultiLock(locks).requestLocks();

        try {
            return await operation();
        } finally {
            multiLock.removeLocks();
        }
    }
}
