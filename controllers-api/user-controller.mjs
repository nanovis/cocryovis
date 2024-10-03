// @ts-check

import User from "../models/user.mjs";
import { ApiError } from "../tools/error-handler.mjs";

export default class UserController {
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
                res.json(User.toPublic(user));
            });
        });
    }

    static async login(req, res, next) {
        try {
            const user = await User.authenticate(
                req.body.username,
                req.body.password
            );
            req.session.regenerate(function (err) {
                if (err) return next(err);

                req.session.user = user;

                req.session.save(function (err) {
                    if (err) return next(err);
                    res.json(User.toPublic(user));
                });
            });
        } catch {
            throw new ApiError(401, "Authentication Failed");
        }
    }

    static logout(req, res) {
        req.session.destroy(function () {
            res.sendStatus(204);
        });
    }
}
