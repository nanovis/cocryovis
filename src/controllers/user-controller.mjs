// @ts-check

import User from "../models/user.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import TaskHistory from "../models/task-history.mjs";

export default class UserController {
    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     * @param {import("express").NextFunction} next
     */
    static async register(req, res, next) {
        const user = await User.create(
            req.body.username,
            req.body.password,
            req.body.name,
            req.body.email
        );

        const userData = User.toPublic(user);

        await UserController.#regenerateSession(req);
        req.session.user = userData;
        await UserController.#saveSession(req);

        res.status(201).json(userData);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     * @param {import("express").NextFunction} next
     */
    static async login(req, res, next) {
        try {
            const user = await User.authenticate(
                req.body.username,
                req.body.password
            );

            const userData = User.toPublic(user);

            await UserController.#regenerateSession(req);
            req.session.user = userData;
            await UserController.#saveSession(req);
            console.log("User " + req.body.username + " just logged in.");

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
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static logout(req, res) {
        req.session.destroy(function () {
            res.sendStatus(204);
        });
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
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
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getAllUsers(req, res) {
        const users = await User.getAllUsers();

        res.json(users);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getStatus(req, res) {
        const taskHistory = await TaskHistory.getFromUser(req.session.user.id);
        const cpuTaskQueue = await TaskHistory.getCPUTaskQueue();
        const gpuTaskQueue = await TaskHistory.getGPUTaskQueue();

        res.json({
            taskHistory: taskHistory,
            cpuTaskQueue: cpuTaskQueue,
            gpuTaskQueue: gpuTaskQueue,
        });
    }
}
