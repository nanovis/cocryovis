// @ts-check

import { ApiError } from "../tools/error-handler.mjs";
import appConfig from "../tools/config.mjs";
import Project from "../models/project.mjs";

/**
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */

export default class DemoController {
    /**
     * @param {Request} req
     * @param {Response} res
     */
    static async getDemo(req, res) {
        const demoProjectIndex = appConfig.demoProjectIndex;
        if (!demoProjectIndex) {
            throw new ApiError(
                500,
                "Demo project index is not set. Please check your configuration."
            );
        }
        const project = await Project.getByIdDeep(demoProjectIndex);

        res.json(project);
    }
}
