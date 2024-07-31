import {readFileSync} from "fs";

export class IModel {
    constructor() {
        if (this.constructor === IModel) {
            throw new Error("Class is of abstract type and can't be instantiated");
        }
        try {
            const configFull = JSON.parse(readFileSync('./config.json', 'utf8'));
            this.config = configFull.projects;
        }
        catch(err) {
            console.error(err);
        }
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new this();
        }
        return this.instance;
    }
}