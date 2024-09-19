// @ts-check

export class LockBlockedError extends Error {
    constructor(message) {
        super(message);
        this.name = "LockBlockedError";
    }
}

class InstanceLockManager {
    /** @type {Number} */ #nextLockId = 0;
    /** @type {Map<Number, Set<Number>>} */ #locks = new Map();

    /**
     * @type {Map<Number, {instanceId: Number, connections: Set<String>?}>}
     */
    #lockKeyToInstanceProperties = new Map();

    /**
     * @type {Map<Number, Map<String, Set<Number>>>}
     */
    #connectionLocks = new Map();

    /**
     * @param {Number} instanceId
     * @return {Boolean}
     */
    isLocked(instanceId) {
        const instanceLocks = this.#locks.get(instanceId);
        return instanceLocks !== undefined && instanceLocks.size > 0;
    }

    /**
     * @param {Number} instanceId
     * @param {String} connection
     * @return {Boolean}
     */
    hasLockedConnection(instanceId, connection) {
        const instanceConnectionLocks = this.#connectionLocks.get(instanceId);
        if (instanceConnectionLocks === undefined) return false;

        const connectionLocks = instanceConnectionLocks.get(connection);
        if (connectionLocks === undefined) return false;

        return connectionLocks.size > 0;
    }

    /**
     * @param {Number} instanceId
     * @param {String[]?} lockConnections
     * @param {Boolean} connectionLockOnly
     * @return {Number}
     */
    requestLock(instanceId, lockConnections = null, connectionLockOnly = false) {
        const lockId = this.#nextLockId;
        this.#nextLockId++;

        if (!connectionLockOnly) {
            let instanceLocks = this.#locks.get(instanceId);
            if (instanceLocks === undefined) {
                instanceLocks = new Set();
                this.#locks.set(instanceId, instanceLocks);
            }
            instanceLocks.add(lockId);
        }

        const lockedConnections = this.#addConnectionLocks(
            instanceId,
            lockId,
            lockConnections
        );

        this.#lockKeyToInstanceProperties.set(lockId, {
            instanceId: instanceId,
            connections: lockedConnections,
        });
        return lockId;
    }

    /**
     * @param {Number[]} instanceIds
     * @param {String[]?} lockConnections
     * @param {Boolean} connectionLockOnly
     * @return {Number[]}
     */
    requestLockMany(
        instanceIds,
        lockConnections = null,
        connectionLockOnly = false
    ) {
        const lockIds = [];
        instanceIds.forEach((id) =>
            lockIds.push(this.requestLock(id, lockConnections, connectionLockOnly))
        );
        return lockIds;
    }

    /**
     * @param {Number} instanceId
     * @param {Number} lockId
     * @param {String[]?} lockConnections
     * @return {Set<String>?}
     */
    #addConnectionLocks(instanceId, lockId, lockConnections = null) {
        if (lockConnections === null) {
            return null;
        }

        let instanceConnectionLocks = this.#connectionLocks.get(instanceId);
        if (instanceConnectionLocks === undefined) {
            instanceConnectionLocks = new Map();
            this.#connectionLocks.set(instanceId, instanceConnectionLocks);
        }
        for (const lockConnection of lockConnections) {
            let connectionLocks = instanceConnectionLocks.get(lockConnection);
            if (connectionLocks === undefined) {
                connectionLocks = new Set();
                instanceConnectionLocks.set(lockConnection, connectionLocks);
            }
            connectionLocks.add(lockId);
        }

        return new Set(lockConnections);
    }

    /**
     * @param {Number} lockId
     */
    removeLock(lockId) {
        const instanceProperties =
            this.#lockKeyToInstanceProperties.get(lockId);
        if (instanceProperties === undefined) return;
        this.#lockKeyToInstanceProperties.delete(lockId);

        const instanceLocks = this.#locks.get(instanceProperties.instanceId);
        if (instanceLocks !== undefined) {
            instanceLocks.delete(lockId);
            if (instanceLocks.size === 0) {
                this.#locks.delete(instanceProperties.instanceId);
            }
        }

        const connectionLocks = this.#connectionLocks.get(
            instanceProperties.instanceId
        );
        if (connectionLocks !== undefined) {
            for (const connection of instanceProperties.connections) {
                const connectionLockSet = connectionLocks.get(connection);
                if (connectionLockSet === undefined) {
                    continue;
                }
                connectionLockSet.delete(lockId);
                if (connectionLockSet.size === 0) {
                    connectionLocks.delete(connection);
                }
            }
            if (connectionLocks.size === 0) {
                this.#connectionLocks.delete(instanceProperties.instanceId);
            }
        }
    }

    /**
     * @param {Number[]} lockIds
     */
    removeLockMany(lockIds) {
        lockIds.forEach((id) => this.removeLock(id));
    }
}

export default class WriteLockManager extends InstanceLockManager {
    #blockedLockManager = new InstanceLockManager();

    /**
     * @param {Number} instanceId
     * @param {String[]?} lockConnections
     * @return {Number}
     */
    requestLock(instanceId, lockConnections = null) {
        if (this.isLockBlocked(instanceId, lockConnections)) {
            throw new LockBlockedError(
                "Another process is currently blocking the locking process."
            );
        }
        return super.requestLock(instanceId, lockConnections);
    }

    /**
     * @param {Number[]} instanceIds
     * @param {String[]?} lockConnections
     * @return {Number[]}
     */
    requestLockMany(instanceIds, lockConnections = null) {
        instanceIds.forEach((id) => {
            if (this.isLockBlocked(id, lockConnections)) {
                throw new LockBlockedError(
                    "Another process is currently blocking the locking process."
                );
            }
        });
        return super.requestLockMany(instanceIds, lockConnections);
    }

    /**
     * @param {Number} instanceId
     * @param {String[]?} lockConnections
     * @return {Boolean}
     */
    isLockBlocked(instanceId, lockConnections = null) {
        if (lockConnections == null) {
            return this.#blockedLockManager.isLocked(instanceId);
        } else {
            return lockConnections.some((l) =>
                this.#blockedLockManager.hasLockedConnection(instanceId, l)
            );
        }
    }

    /**
     * @param {Number} instanceId
     * @param {String[]?} lockConnections
     * @returns {Number}
     */
    blockWriteLocks(instanceId, lockConnections = null) {
        if ((lockConnections = null)) {
            return this.#blockedLockManager.requestLock(
                instanceId,
                lockConnections
            );
        } else {
            return this.#blockedLockManager.requestLock(
                instanceId,
                lockConnections,
                true
            );
        }
    }

    /**
     * @param {Number[]} instanceIds
     * @returns {Number[]}
     */
    blockWriteLocksMany(instanceIds, lockConnections = null) {
        return this.#blockedLockManager.requestLockMany(
            instanceIds,
            lockConnections
        );
    }

    /**
     * @param {Number} blockId
     */
    unblockWriteLocks(blockId) {
        this.#blockedLockManager.removeLock(blockId);
    }

    /**
     * @param {Number[]} blockIds
     */
    unblockWriteLocksMany(blockIds) {
        this.#blockedLockManager.removeLockMany(blockIds);
    }
}
