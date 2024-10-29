// @ts-check

import Project from "../models/project.mjs";

export default class ProjectController {
    static async getAllUserProjects(req, res) {
        const options = ProjectController.#parseOptionQuery(req);
        const projects = await Project.getUserProjects(
            req.session.user.id,
            options
        );

        return res.json(projects);
    }

    static async getProject(req, res) {
        const options = ProjectController.#parseOptionQuery(req);
        const project = await Project.getById(
            Number(req.params.idProject),
            options
        );

        return res.json(project);
    }

    /**
     * @returns {import("../models/project.mjs").Options}
     */
    static #parseOptionQuery(req) {
        const options = {
            volumes: !!req?.query?.volumes,
            models: (() => {
                if (!req?.query?.models) return false;
                return req?.query?.checkpoints
                    ? { include: { checkpoints: true } }
                    : true;
            })(),
            owner: !!req?.query?.owner,
        };

        return options;
    }

    static async createProject(req, res) {
        const project = await Project.create(
            req.body.name,
            req.body.description,
            req.session.user.id
        );
        return res.status(201).json(project);
    }

    static async deepCloneProject(req, res) {
        const project = await Project.deepClone(
            Number(req.params.idProject),
            req.session.user.id
        );
        return res.status(201).json(project);
    }

    static async deleteProject(req, res) {
        const project = await Project.del(Number(req.params.idProject));

        return res.sendStatus(204);
    }
}
