// @ts-check

import { ApiError } from "../tools/error-handler.mjs";

/**
 * @param {AuthenticatedRequest} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export const restrictApi = (req, res, next) => {
    if (!req.session || !req.session.user) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }
    next();
};
