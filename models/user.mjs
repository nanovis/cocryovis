// @ts-check

import DatabaseModel from "./base-model.mjs";
import bkfd2Password from "pbkdf2-password";
import prismaManager from "../tools/prisma-manager.mjs";

/**
 * @typedef { import("@prisma/client").User } UserDB
 */

export default class User extends DatabaseModel {
    static hasher = bkfd2Password();
    /**
     * @return {String}
     */
    static get modelName() {
        return "user";
    }

    static get db() {
        return prismaManager.db.user;
    }

    /**
     * @param {String} username
     * @param {String} password
     * @return {Promise<UserDB>}
     */
    static async authenticate(username, password) {
        const user = await User.getByUsername(username);
        return await new Promise((resolve, reject) => {
            User.hasher(
                { password: password, salt: user.passwordSalt },
                function (err, pass, salt, hash) {
                    if (err) return reject(err);
                    if (hash !== user.passwordHash)
                        return reject(new Error("Authentication Failed"));
                    return resolve(user);
                }
            );
        });
    }

    /**
     * @param {Number} id
     * @return {Promise<UserDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {String} username
     * @return {Promise<UserDB>}
     */
    static async getByUsername(username) {
        let user = await prismaManager.db.user.findUnique({
            where: { username: username },
        });
        if (!user) {
            throw new Error(`Cannot find User with username ${username}`);
        }
        return user;
    }

    /**
     * @param {String} username
     * @param {String} name
     * @param {String} email
     * @param {String} password
     * @return {Promise<UserDB>}
     */
    static async create(username, name, email, password) {
        const { salt, hash } = await new Promise((resolve, reject) => {
            User.hasher(
                { password: password },
                function (err, pass, salt, hash) {
                    if (err) throw new Error("Error hashing user password.");
                    return { salt: salt, hash: hash };
                }
            );
        });

        return await prismaManager.db.user.create({
            data: {
                username: username,
                name: name,
                email: email,
                passwordSalt: salt,
                passwordHash: hash,
            },
        });
    }

    /**
     * @param {Number} id
     * @param {import("@prisma/client").Prisma.UserUpdateInput & {password: String}} changes
     * @returns {Promise<UserDB>}
     */
    static async update(id, changes) {
        if (Object.hasOwn(changes, "password")) {
            const { salt, hash } = await new Promise((resolve, reject) => {
                User.hasher(
                    { password: changes.password },
                    function (err, pass, salt, hash) {
                        if (err)
                            throw new Error("Error hashing user password.");
                        return { salt: salt, hash: hash };
                    }
                );
            });
            changes.passwordSalt = salt;
            changes.passwordHash = hash;
            delete changes.password;
        }

        return prismaManager.db.user.update({
            where: { id: id },
            data: changes,
        });
    }

    /**
     * @param {Number} id
     */
    static async del(id) {
        return await super.del(id);
    }
}
