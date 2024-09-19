// @ts-check

import WriteLockManager from "../tools/write-lock-manager.mjs";

export default class DatabaseModel {
    /** @type {WriteLockManager?} */ static lockManager = null;

    /**
     * @return {String}
     */
    static get modelName() {
        throw new Error("Method not implemented");
    }

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
        const entry = await this.db.findUnique({
            where: { id: id },
        });
        if (!entry) {
            throw new Error(`Cannot find ${this.modelName} with ID ${id}`);
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
        return this.withBlockedWriteLock(id, () => {
            return this.db.update({
                where: { id: id },
                data: changes,
            });
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<Object>}
     */
    static async del(id) {
        return this.withBlockedWriteLock(id, () => {
            return this.db.delete({
                where: { id: id },
            });
        });
    }

    /**
     * @param {Number} id
     * @param {Function} operation
     */
    static async withBlockedWriteLock(id, operation) {
        if (this.lockManager === null) return operation();

        if (this.lockManager.isLocked(id)) {
            throw new Error(
                `Instance of ${this.modelName} with id ${id} is currently locked due to it being a part of ongoing operation.`
            );
        }
        const blockId = this.lockManager.blockWriteLocks(id);
        try {
            return await operation();
        } finally {
            this.lockManager.unblockWriteLocks(blockId);
        }
    }

    /**
     * @param {Number[]} ids
     * @param {Function} operation
     */
    static async withManyBlockedWriteLock(ids, operation) {
        if (this.lockManager === null || ids.length === 0) return operation();

        ids.forEach((id) => {
            if (this.lockManager !== null && this.lockManager.isLocked(id)) {
                throw new Error(
                    `Instance of ${this.modelName} with id ${id} is currently locked due to it being a part of ongoing operation.`
                );
            }
        });
        const blockIds = this.lockManager.blockWriteLocksMany(ids);
        try {
            return await operation();
        } finally {
            this.lockManager.unblockWriteLocksMany(blockIds);
        }
    }

    /**
     * @template T
     * @param {Number} id
     * @param {String} connection
     * @param {() => T} operation
     * @returns {Promise<T>}
     */
    static async withBlockedConnectionWriteLock(id, connection, operation) {
        if (this.lockManager === null) return await operation();

        if (this.lockManager.hasLockedConnection(id, connection)) {
            throw new Error(
                `Connections between instance ${this.modelName} with id ${id} and its instances of ${connection} are currently locked due to them being a part of ongoing operation.`
            );
        }
        const blockId = this.lockManager.blockWriteLocks(id, [connection]);
        try {
            return await operation();
        } finally {
            this.lockManager.unblockWriteLocks(blockId);
        }
    }

    /**
     * @param {Number} id
     */
    static lockCheck(id) {
        return;
    }

    /**
     * @param {Number[]} ids
     */
    static lockCheckMany(ids) {
        return;
    }

    /**
     * @param {Number} id
     * @param {String} connection
     */
    static connectionLockCheck(id, connection) {
        return;
    }

    /**
     * @param {Number} id
     * @returns {Number}
     */
    static lockCheckAndBlock(id) {
        return;
    }

    /**
     * @param {Number[]} ids
     * @returns {Number[]}
     */
    static lockCheckManyAndBlock(ids) {
        return [];
    }

    /**
     * @param {Number} id
     * @param {String} connection
     * @returns {Number}
     */
    static connectionLockCheckAndBlock(id, connection) {
        return 0;
    }

    /**
     * @param {Number} lockId
     */
    static removeLock(lockId) {
        return;
    }

    /**
     * @param {Number[]} lockIds
     */
    static removeLockMany(lockIds) {
        return;
    }

    /**
     * @param {Number} blockId
     */
    static unblockLock(blockId) {
        return 0;
    }

    /**
     * @param {Number[]} blockIds
     */
    static unblockLockMany(blockIds) {
        return;
    }

    // /**
    //  * @param {Number} id
    //  */
    // static lockCheck(id) {
    //     if (this.lockManager === null) return;

    //     if (this.lockManager.isLocked(id)) {
    //         throw new Error(
    //             `Instance of ${this.modelName} with id ${id} is currently locked due to it being a part of ongoing operation.`
    //         );
    //     }
    // }

    // /**
    //  * @param {Number[]} ids
    //  */
    // static lockCheckMany(ids) {
    //     if (ids.length === 0 || this.lockManager === null) return;

    //     ids.forEach((id) => {
    //         if (this.lockManager !== null && this.lockManager.isLocked(id)) {
    //             throw new Error(
    //                 `Instance of ${this.modelName} with id ${id} is currently locked due to it being a part of ongoing operation.`
    //             );
    //         }
    //     });
    // }

    // /**
    //  * @param {Number} id
    //  * @param {String} connection
    //  */
    // static connectionLockCheck(id, connection) {
    //     if (this.lockManager === null) return;

    //     if (this.lockManager.hasLockedConnection(id, connection)) {
    //         throw new Error(
    //             `Connections between instance ${this.modelName} with id ${id} and its instances of ${connection} are currently locked due to them being a part of ongoing operation.`
    //         );
    //     }
    // }

    ///////////////////////

    // /**
    //  * @param {Number} id
    //  * @returns {Number}
    //  */
    // static lockCheckAndBlock(id) {
    //     if (this.lockManager === null) return;

    //     if (this.lockManager.isLocked(id)) {
    //         throw new Error(
    //             `Instance of ${this.modelName} with id ${id} is currently locked due to it being a part of ongoing operation.`
    //         );
    //     }
    //     return this.lockManager.blockLock(id);
    // }

    // /**
    //  * @param {Number[]} ids
    //  * @returns {Number[]}
    //  */
    // static lockCheckManyAndBlock(ids) {
    //     if (ids.length === 0 || this.lockManager === null) return;

    //     ids.forEach((id) => {
    //         if (this.lockManager.isLocked(id)) {
    //             throw new Error(
    //                 `Instance of ${this.modelName} with id ${id} is currently locked due to it being a part of ongoing operation.`
    //             );
    //         }
    //     });
    //     return this.lockManager.blockLockMany(ids);
    // }

    // /**
    //  * @param {Number} id
    //  * @param {String} connection
    //  * @returns {Number}
    //  */
    // static connectionLockCheckAndBlock(id, connection) {
    //     if (this.lockManager === null) return;

    //     if (this.lockManager.hasLockedConnection(id, connection)) {
    //         throw new Error(
    //             `Connections between instance ${this.modelName} with id ${id} and its instances of ${connection} are currently locked due to them being a part of ongoing operation.`
    //         );
    //     }
    //     return this.lockManager.blockLock(id, connection);
    // }

    // /**
    //  * @param {Number} lockId
    //  */
    // static removeLock(lockId) {
    //     if (this.lockManager === null) return;

    //     this.lockManager.removeLock(lockId);
    // }

    // /**
    //  * @param {Number[]} lockIds
    //  */
    // static removeLockMany(lockIds) {
    //     if (this.lockManager === null) return;

    //     this.lockManager.removeLockMany(lockIds);
    // }

    // /**
    //  * @param {Number} blockId
    //  */
    // static unblockLock(blockId) {
    //     if (this.lockManager === null) return;

    //     this.lockManager.unblockLock(blockId);
    // }

    // /**
    //  * @param {Number[]} blockIds
    //  */
    // static unblockLockMany(blockIds) {
    //     if (this.lockManager === null) return;

    //     this.lockManager.unblockLockMany(blockIds);
    // }
}
