import lowdbVolumeController from "../controllers/lowdb/lowdb-volume-controller.mjs";
import lowdbModelController from "../controllers/lowdb/lowdb-model-controller.mjs";
import {ModelView} from "./model-view";

export class ProjectView {
    constructor(project) {
        this.id = project.id;
        this.name = project.name;
        this.description = project.description;
        this.userId = project.userId;

        this.volumes = lowdbVolumeController.getByIds(project.volumeIds);
        this.models = lowdbModelController.getByIds(project.models).map(model => new ModelView(model));
        Object.preventExtensions(this);
    }
}