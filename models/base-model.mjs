// @ts-check

export default class DatabaseModel {
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
        return this.db.update({
            where: { id: id },
            data: changes,
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<Object>}
     */
    static async del(id) {
        return await this.db.delete({
            where: { id: id },
        });
    }
}
