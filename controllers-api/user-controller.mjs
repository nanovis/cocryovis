// @ts-check

import { log } from "util";
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

            const UserData = await User.toPublic(user);

            req.session.regenerate(function (err) {
                if (err) return next(err);

                req.session.user = user;
                
                req.session.save(function (err) {
                    if (err) return next(err);

                    log("Session saved.");
                    res.json(UserData);
                });

                log("User " + req.body.username + " just logged in.")
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

    static async getLoggedUserData(req, res) {
        try {
            if (req.session != null) {
                const UserData = await User.toPublic(req.session.user);
                return res.json(UserData);
            }
            else {
                res.sendStatus(401);
            }
        }
        catch {
            res.sendStatus(401);
        }
    }
}
