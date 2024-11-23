// @ts-check

import Project from "../models/project.mjs";

export default class ProjectController {
    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getAllUserProjects(req, res) {
        const options = ProjectController.#parseOptionQuery(req);
        const projects = await Project.getUserProjects(
            req.session.user.id,
            options
        );
        res.json(projects);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getAllUserProjectsDeep(req, res) {
        const projects = await Project.getUserProjectsDeep(req.session.user.id);
        res.json(projects);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getProject(req, res) {
        const options = ProjectController.#parseOptionQuery(req);
        const project = await Project.getById(
            Number(req.params.idProject),
            options
        );

        res.json(project);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @returns {import("../models/project.mjs").Options}
     */
    static #parseOptionQuery(req) {
        const options = {
            volumes: (() => {
                if (!req?.query?.volumes) return false;
                const fullVolume = req.query.volumes === "full";
                const query = {};
                if (req.query.rawData || fullVolume) {
                    query.rawData = true;
                }
                if (req.query.sparseVolumes || fullVolume) {
                    query.sparseVolumes = true;
                }
                if (req.query.pseudoVolumes || fullVolume) {
                    query.pseudoVolumes = true;
                }
                if (req.query.results || fullVolume) {
                    query.results = true;
                }

                return Object.keys(query).length > 0
                    ? { include: query }
                    : true;
            })(),
            models: (() => {
                if (!req?.query?.models) return false;
                return req.query.checkpoints || req.query.models === "full"
                    ? { include: { checkpoints: true } }
                    : true;
            })(),
            owner: !!req?.query?.owner,
        };

        return options;
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async getAccessInfo(req, res) {
        const accessInfo = await Project.getAccessInfo(
            Number(req.params.idProject)
        );

        res.json(accessInfo);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async setAccess(req, res) {
        const accessInfo = await Project.setAccess(
            Number(req.params.idProject),
            req.body
        );

        res.json(accessInfo);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async createProject(req, res) {
        const project = await Project.create(
            req.body.name,
            req.body.description,
            req.session.user.id
        );

        res.status(201).json(project);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async deepCloneProject(req, res) {
        const project = await Project.deepClone(
            Number(req.params.idProject),
            req.session.user.id
        );

        res.status(201).json(project);
    }

    /**
     * @param {AuthenticatedRequest} req
     * @param {import("express").Response} res
     */
    static async deleteProject(req, res) {
        const project = await Project.del(Number(req.params.idProject));

        res.sendStatus(204);
    }
}
