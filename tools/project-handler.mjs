import { Project } from "./project.mjs";

export class ProjectHandler {
    constructor(projects) {
        this.projects = projects;
    }

    addNewProject(project) {
        if (this.projects.length === 0) {
            project.id = 1;
        } else {
            project.id = this.projects.at(-1).id + 1;
        }
        this.projects.push(project);
        return project.id;
    }

    findProject(id) {
        const projectReference = this.projects.find((p) => p.id === id);
        return Project.fromReference(projectReference);
    }
}