// @ts-check

import User from "../models/user.mjs";

export default class UserController {
    static async login(req, res) {
        try {
            let user = await User.authenticate(
                req.body.username,
                req.body.password
            );
            req.session.regenerate(function () {
                // Store the user's primary key in the session store to be retrieved,
                // or in this case the entire user object
                req.session.user = user;
                res.redirect("/auth");
            });
        } catch (err) {
            req.session.error = "Authentication failed!";
            res.send({ success: false });
        }
    }

    static logout(req, res) {
        req.session.destroy(function () {
            res.redirect("/");
            // res.send({success: true})
        });
    }
}
