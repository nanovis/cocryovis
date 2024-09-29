// @ts-check

import Project from "../models/project.mjs";

export default class ProjectController {
    static async getAllUserProjects(req, res) {
        const projects = await Project.getUserProjects(req.session.user.id);
        return res.json(projects);
    }

    static async getProjectDetails(req, res, next) {
        const project = await Project.getByIdDeep(Number(req.params.idProject));
        return res.json(project);
    }

    static async createProject(req, res) {
        const project = await Project.create(
            req.body.name,
            req.body.description,
            req.session.user.id
        );
        return res.status(201).json(project);
    }

    static async deleteProject(req, res) {
        const project = await Project.del(Number(req.params.idProject));

        return res.sendStatus(204);
    }
}
