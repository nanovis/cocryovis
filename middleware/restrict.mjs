// @ts-check

import { ApiError } from "../tools/error-handler.mjs";

export const restrict = (req, res, next) => {
    if (!req.session) {
        res.redirect("/login");
    } else if (req.session.user) {
        next();
    } else {
        req.session.error = "Access denied!";
        res.redirect("/login");
    }
};

export const restrictApi = (req, res, next) => {
    if (!req.session || !req.session.user) {
        throw new ApiError(403, `Access to ${req.originalUrl} denied!`);
    }
    next();
};
