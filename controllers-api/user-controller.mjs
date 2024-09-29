// @ts-check

import User from "../models/user.mjs";
import { ApiError } from "../tools/error-handler.mjs";

export default class UserController {
    static async login(req, res, next) {
        try {
            let user = await User.authenticate(
                req.body.username,
                req.body.password
            );
            req.session.regenerate(function (err) {
                if (err) return next(err);

                req.session.user = user;

                req.session.save(function (err) {
                    if (err) return next(err);
                    console.log(req.sessionID)
                    res.sendStatus(204);
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
