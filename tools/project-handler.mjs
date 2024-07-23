import { Project } from "./project.mjs";

export class ProjectHandler {
    constructor(db) {
        this.db = db;
    }

    async addNewProject(project) {
        const projects = this.db.data.projects;
        if (projects.length === 0) {
            project.id = 1;
        } else {
            project.id = projects.at(-1).id + 1;
        }
        // this.projects.push(project);
        await this.db.update(({ projects }) => projects.push(project))
        return project.id;
    }

    findProject(id) {
        const projectReference = this.db.data.projects.find((p) => p.id === id);
        return Project.fromReference(projectReference);
    }

    projectsFromUser(userId) {
        const projectReferences = this.db.data.projects.filter((p) => p.userId = userId)
        return projectReferences.map((p) => Project.fromReference(p));
    }

    async deleteProject(id) {
        try {
            const projectIndex = this.db.data.projects.findIndex((p) => p.id === id);
            await this.db.update(({ projects }) => projects.splice(projectIndex, 1))
            console.log("Project successfully deleted.");
        } catch (err) {
            console.error("Error deleting project.");
        }
    }
}