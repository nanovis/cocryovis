// @ts-check

export class BaseModel {
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
        let entry = await this.db.findUnique({
            where: { id: id },
        });
        if (!entry) {
            throw new Error(`Cannot find ${this.modelName} with ID ${id}`);
        }
        return entry;
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
