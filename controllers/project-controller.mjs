// @ts-check

import { Project } from "../models/project.mjs";

export class ProjectController {
    static async getAllUserProjects(req, res) {
        try {
            const projects = await Project.getUserProjects(req.session.user.id);
            res.render("project-list", { projects: projects });
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async getProjectDetails(req, res) {
        try {
            const project = await Project.getByIdDeep(Number(req.params.id));
            res.render("project-details", { project: project });
        } catch (err) {
            res.status(500).send(err);
        }
    }

    static async createProject(req, res) {
        console.log("Creating a new project");
        try {
            const project = await Project.create(
                req.body.name,
                req.body.description,
                req.session.user.id
            );

            console.log("Project successfully created.");
            res.redirect(`/api/actions/projects/details/${project.id}`);
        } catch (err) {
            console.error("Error in creating project:", err);
            res.status(500).send(err);
        }
    }

    static async deleteProject(req, res) {
        try {
            await Project.del(Number(req.params.id));

            res.redirect(`/api/actions/projects/`);
        } catch (err) {
            res.status(500).send(err);
        }
    }
}
