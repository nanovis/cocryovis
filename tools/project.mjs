export class Project {
    constructor(name, userId, description = "", id = -1) {
        this.name = name;
        this.userId = userId;
        this.description = description;
        this.id = id;
    }

    static fromReference(dbProject) {
        return new Project(dbProject.name, dbProject.userId, dbProject.description, dbProject.id);
    }
}