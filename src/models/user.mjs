// @ts-check

import DatabaseModel from "./database-model.mjs";
import bkfd2Password from "pbkdf2-password";
import prismaManager from "../tools/prisma-manager.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @typedef { import("@prisma/client").User } UserDB
 * @typedef {{ id: Number, username: String, name: String, email: String }} PublicUser
 */

export default class User extends DatabaseModel {
    static modelName = "user";
    static lockManager = new WriteLockManager(this.modelName);

    static hasher = bkfd2Password();

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
                        return reject(
                            new ApiError(401, "Authentication Failed")
                        );
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
     * @param {Number[]} ids
     * @return {Promise<UserDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
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
            throw new ApiError(
                404,
                `Cannot find User with username ${username}`
            );
        }
        return user;
    }

    /**
     * @return {Promise<UserDB[]>}
     */
    static async getAllUsers() {
        return await prismaManager.db.user.findMany();
    }

    /**
     * @param {String} username
     * @param {String} password
     * @param {String} name
     * @param {String} email
     * @return {Promise<UserDB>}
     */
    static async create(username, password, name, email) {
        if (!username || username.length === 0) {
            throw new ApiError(400, "Missing username.");
        }
        if (!password || password.length === 0) {
            throw new ApiError(400, "Missing password.");
        }
        const { salt, hash } = await new Promise((resolve, reject) => {
            User.hasher(
                { password: password },
                function (err, pass, salt, hash) {
                    if (err) reject(new Error("Error hashing user password."));
                    resolve({ salt: salt, hash: hash });
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

    /**
     * @param {UserDB} user
     * @returns {PublicUser}
     */
    static toPublic(user) {
        return {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
        };
    }
}
