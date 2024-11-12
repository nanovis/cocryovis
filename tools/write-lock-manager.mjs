// @ts-check

export class LockBlockedError extends Error {
    /**
     * @param {String} message
     * @param {Number} instanceId
     * @param {String} instanceName
     */
    constructor(message, instanceId, instanceName) {
        super(message);
        this.name = "LockBlockedError";
        this.instanceId = instanceId;
        this.instanceName = instanceName;
    }
}

export class WriteLock {
    /** @type {Number} */ #instanceId;
    /** @type {String[]?} */ #connections = null;
    /** @type {WriteLockManager} */ #lockManager;
    /** @type {Boolean} */ #active = false;

    /**
     * @param {Number} instanceId
     * @param {String[]?} connections
     * @param {WriteLockManager} lockManager
     */
    constructor(instanceId, connections, lockManager) {
        this.#instanceId = instanceId;
        this.#connections =
            connections === null ? null : Array.from(connections);
        this.#lockManager = lockManager;
    }

    get instanceId() {
        return this.#instanceId;
    }

    get connections() {
        return this.#connections;
    }

    get lockManager() {
        return this.#lockManager;
    }

    /**
     * @returns {WriteLock}
     */
    requestLock() {
        if (this.#active) {
            console.error("Lock already active");
            return;
        }

        try {
            if (this.isLockBlocked()) {
                throw new LockBlockedError(
                    `Instance of ${this.#lockManager.instanceName} with id ${
                        this.#instanceId
                    } is currently locked due to it being a part of ongoing operation.`,
                    this.#instanceId,
                    this.#lockManager.instanceName
                );
            }

            let instanceLocks = this.#lockManager.locks.get(this.#instanceId);
            if (instanceLocks === undefined) {
                instanceLocks = new Set();
                this.#lockManager.locks.set(this.#instanceId, instanceLocks);
            }
            instanceLocks.add(this);

            if (this.#connections !== null) {
                let instanceConnectionLocks =
                    this.#lockManager.connectionLocks.get(this.#instanceId);
                if (instanceConnectionLocks === undefined) {
                    instanceConnectionLocks = new Map();
                    this.#lockManager.connectionLocks.set(
                        this.#instanceId,
                        instanceConnectionLocks
                    );
                }
                for (const lockConnection of this.#connections) {
                    let connectionLocks =
                        instanceConnectionLocks.get(lockConnection);
                    if (connectionLocks === undefined) {
                        connectionLocks = new Set();
                        instanceConnectionLocks.set(
                            lockConnection,
                            connectionLocks
                        );
                    }
                    connectionLocks.add(this);
                }
            }

            this.#active = true;
            return this;
        } catch (error) {
            if (!(error instanceof LockBlockedError)) {
                this.removeLock();
            }
            throw error;
        }
    }

    removeLock() {
        const instanceLocks = this.#lockManager.locks.get(this.#instanceId);
        if (instanceLocks !== undefined) {
            instanceLocks.delete(this);
            if (instanceLocks.size === 0) {
                this.#lockManager.locks.delete(this.#instanceId);
            }
        }

        if (this.#connections !== null) {
            const connectionLocks = this.#lockManager.connectionLocks.get(
                this.#instanceId
            );
            if (connectionLocks !== undefined) {
                for (const connection of this.#connections) {
                    const connectionLockSet = connectionLocks.get(connection);
                    if (connectionLockSet === undefined) {
                        continue;
                    }
                    connectionLockSet.delete(this);
                    if (connectionLockSet.size === 0) {
                        connectionLocks.delete(connection);
                    }
                }
                if (connectionLocks.size === 0) {
                    this.#lockManager.connectionLocks.delete(this.#instanceId);
                }
            }
        }
    }

    /**
     * @returns {Boolean}
     */
    isLockBlocked() {
        return this.#lockManager.isLockBlocked(
            this.instanceId,
            this.connections
        );
    }
}

export class WriteMultiLock {
    /** @type {WriteLock[]} */ #writeLocks;

    /**
     * @param {WriteLock[]} writeLocks
     */
    constructor(writeLocks) {
        this.#writeLocks = writeLocks;
    }

    /**
     * @returns {WriteMultiLock}
     */
    requestLocks() {
        this.#writeLocks.forEach((writeLock) => {
            if (writeLock.isLockBlocked()) {
                throw new LockBlockedError(
                    `Instance of ${writeLock.lockManager.instanceName} with id ${writeLock.instanceId} is currently locked due to it being a part of ongoing operation.`,
                    writeLock.instanceId,
                    writeLock.lockManager.instanceName
                );
            }
        });
        this.#writeLocks.forEach((writeLock) => {
            writeLock.requestLock();
        });
        return this;
    }

    removeLocks() {
        this.#writeLocks.forEach((writeLock) => {
            writeLock.removeLock();
        });
    }

    /**
     * @template T
     * @param {WriteMultiLock} multilock
     * @param {() => Promise<T>} operation
     */
    static withWriteMultiLock(multilock, operation) {
        multilock.requestLocks();

        operation().finally(() => {
            multilock.removeLocks();
        });
    }
}

export default class WriteLockManager {
    /** @type {Map<Number, Set<WriteLock>>} */ #locks = new Map();
    /**
     * @type {Map<Number, Map<String, Set<WriteLock>>>}
     */
    #connectionLocks = new Map();

    /** @type {String} */ #instanceName;

    /**
     * @param {String} instanceName
     */
    constructor(instanceName) {
        this.#instanceName = instanceName;

        Object.preventExtensions(this);
    }

    get locks() {
        return this.#locks;
    }
    get connectionLocks() {
        return this.#connectionLocks;
    }
    get instanceName() {
        return this.#instanceName;
    }

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
     * @return {Boolean}
     */
    isLockBlocked(instanceId, lockConnections = null) {
        if (lockConnections == null) {
            return this.isLocked(instanceId);
        } else {
            return lockConnections.some((l) =>
                this.hasLockedConnection(instanceId, l)
            );
        }
    }

    /**
     * @param {Number} instanceId
     * @param {String[]?} connections
     * @returns {WriteLock}
     */
    requestLock(instanceId, connections = null) {
        return new WriteLock(instanceId, connections, this).requestLock();
    }

    /**
     * @param {Number} instanceId
     * @param {String[]?} connections
     * @returns {WriteLock}
     */
    generateLockInstance(instanceId, connections = null) {
        return new WriteLock(instanceId, connections, this);
    }
}
