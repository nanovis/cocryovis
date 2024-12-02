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

        req.session.regenerate(function (err) {
            if (err) return next(err);

            req.session.user = userData;

            req.session.save(function (err) {
                if (err) return next(err);
                res.status(201).json(userData);
            });
        });
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

            req.session.regenerate(function (err) {
                if (err) return next(err);

                req.session.user = userData;

                req.session.save(function (err) {
                    if (err) return next(err);

                    res.json(userData);
                });

                console.log("User " + req.body.username + " just logged in.");
            });
        } catch {
            throw new ApiError(401, "Authentication Failed");
        }
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
