// @ts-check

import DatabaseModel from "./database-model.mjs";
import bkfd2Password from "pbkdf2-password";
import prismaManager from "../tools/prisma-manager.mjs";
import WriteLockManager from "../tools/write-lock-manager.mjs";
import { ApiError } from "../tools/error-handler.mjs";

/**
 * @import { publicUser } from "#schemas/user-path-schema.mjs"
 * @import z from "zod"
 * @typedef { import("@prisma/client").User } UserDB
 * @typedef {z.infer<publicUser>} PublicUser
 */

export default class User extends DatabaseModel {
    static modelName = "user";
    static lockManager = new WriteLockManager(this.modelName);

    static hasher = bkfd2Password();

    static get db() {
        return prismaManager.db.user;
    }

    /**
     * @param {string} username
     * @param {string} password
     * @returns {Promise<UserDB>}
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
     * @param {number} id
     * @returns {Promise<UserDB>}
     */
    static async getById(id) {
        return await super.getById(id);
    }

    /**
     * @param {number[]} ids
     * @returns {Promise<UserDB[]>}
     */
    static async getByIds(ids) {
        return await super.getByIds(ids);
    }

    /**
     * @param {string} username
     * @returns {Promise<UserDB>}
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

    static async getAllUsers() {
        return await prismaManager.db.user.findMany({
            omit: {
                passwordSalt: true,
                passwordHash: true,
            },
        });
    }

    /**
     * @param {string} username
     * @param {string} password
     * @param {string} name
     * @param {string} email
     * @returns {Promise<UserDB>}
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
     * @param {number} id
     * @param {import("@prisma/client").Prisma.UserUpdateInput & {password?: string}} changes
     * @returns {Promise<UserDB>}
     */
    static async update(id, changes) {
        if (Object.hasOwn(changes, "password")) {
            const { salt, hash } = await new Promise((resolve, reject) => {
                User.hasher(
                    { password: changes.password },
                    function (err, pass, salt, hash) {
                        if (err) reject("Error hashing user password.");
                        resolve({ salt: salt, hash: hash });
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
     * @param {number} id
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
            admin: user.admin,
        };
    }
}
