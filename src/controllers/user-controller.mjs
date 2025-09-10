// @ts-check

import User from "../models/user.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import TaskHistory from "../models/task-history.mjs";
import appConfig from "../tools/config.mjs";
import validateSchema from "../tools/validate-schema.mjs";
import {
    idUserSchema,
    loginSchemaReq,
    registerSchema,
    statusQuery,
    updateUserSchema,
} from "#schemas/user-path-schema.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class UserController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async register(req, res) {
        const { body } = validateSchema(req, { bodySchema: registerSchema });

        const user = await User.create(
            body.username,
            body.password,
            body.name,
            body.email
        );

        const userData = User.toPublic(user);

        await UserController.#regenerateSession(req);
        req.session.user = userData;
        await UserController.#saveSession(req);

        res.status(201).json(userData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async login(req, res) {
        const { body } = validateSchema(req, { bodySchema: loginSchemaReq });

        try {
            const user = await User.authenticate(body.username, body.password);

            const userData = User.toPublic(user);

            await UserController.#regenerateSession(req);
            req.session.user = userData;
            await UserController.#saveSession(req);
            console.log("User " + body.username + " just logged in.");

            res.json(userData);
        } catch {
            throw new ApiError(401, "Authentication Failed");
        }
    }

    static async #regenerateSession(req) {
        return new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    static async #saveSession(req) {
        return new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static logout(req, res) {
        req.session.destroy(function () {
            res.clearCookie(appConfig.cookieName);
            res.sendStatus(204);
        });
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getLoggedUserData(req, res) {
        try {
            if (req.session != null) {
                res.json(req.session.user);
            } else {
                res.sendStatus(401);
            }
        } catch {
            res.sendStatus(401);
        }
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getAllUsers(req, res) {
        const users = await User.getAllUsers();

        res.json(users);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getStatus(req, res) {
        const { query } = validateSchema(req, {
            querySchema: statusQuery,
        });
        const taskHistory = await TaskHistory.getFromUser(
            req.session.user.id,
            query.pageNumber,
            query.pageSize
        );
        const cpuTaskQueue = await TaskHistory.getCPUTaskQueue();
        const gpuTaskQueue = await TaskHistory.getGPUTaskQueue();

        res.json({
            taskHistory: taskHistory,
            cpuTaskQueue: cpuTaskQueue,
            gpuTaskQueue: gpuTaskQueue,
        });
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async updateUser(req, res) {
        const { body } = validateSchema(req, { bodySchema: updateUserSchema });

        const id = req.session.user.id;
        const user = await User.update(id, body);
        const userData = User.toPublic(user);

        await UserController.#regenerateSession(req);
        req.session.user = userData;
        await UserController.#saveSession(req);
        res.json(userData);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async deleteUser(req, res) {
        await User.del(req.session.user.id);

        res.sendStatus(204);
    }

    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async adminDeleteUser(req, res) {
        const { body } = validateSchema(req, { bodySchema: idUserSchema });
        if (req.session.user.id === body.id) {
            throw new ApiError(
                400,
                "This action cannot be used to delete your own account."
            );
        }
        const user = await User.getById(body.id);
        if (user.admin) {
            throw new ApiError(
                400,
                "This action cannot be used to delete an administrator account."
            );
        }
        await User.del(body.id);

        res.sendStatus(204);
    }
}
