// @ts-check

import User from "../models/user.mjs";
import { ApiError } from "../tools/error-handler.mjs";
import IlastikHandler from "../tools/ilastik-handler.mjs";
import NanoOetziHandler from "../tools/nano-oetzi-handler.mjs";

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
        req.session.regenerate(function (err) {
            if (err) return next(err);

            req.session.user = user;

            req.session.save(function (err) {
                if (err) return next(err);
                res.status(201).json(User.toPublic(user));
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

            const UserData = User.toPublic(user);

            req.session.regenerate(function (err) {
                if (err) return next(err);

                req.session.user = user;

                req.session.save(function (err) {
                    if (err) return next(err);

                    res.json(UserData);
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
                return res.json(req.session.user);
            } else {
                res.sendStatus(401);
            }
        } catch {
            res.sendStatus(401);
        }
    }

    /**
     * @param {IlastikHandler} ilastik
     * @param {NanoOetziHandler} nanoOetzi
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getStatus(ilastik, nanoOetzi, req, res) {
        const ilastikTaskQueue = await ilastik.getTaskQueue();
        const ilastikTaskHistory = await ilastik.taskHistory.getUserTaskHistory(
            req.session.user.id
        );
        const nanoOetziTaskQueue = await nanoOetzi.getTaskQueue();
        const nanoOetziTaskHistory =
            await nanoOetzi.taskHistory.getUserTaskHistory(req.session.user.id);

        return res.json({
            ilastikTaskQueue: ilastikTaskQueue,
            ilastikTaskHistory: ilastikTaskHistory,
            nanoOetziTaskQueue: nanoOetziTaskQueue,
            nanoOetziTaskHistory: nanoOetziTaskHistory,
        });
    }
}
