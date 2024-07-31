// import { IProjectModel } from "../i-project-model.mjs";
// import {Project} from "../project.mjs";
// import {Volume} from "../volume.mjs";
// import LowdbManager from "../../tools/lowdb-manager.mjs";
// import path from "path";
// import {SparseLabeledVolume} from "../sparse-labeled-volume.mjs";
// import {PseudoLabeledVolume} from "../pseudo-labeled-volume.mjs";
// import {Model} from "../model.mjs";
// import {saveData} from "../../tools/utils.mjs";
//
// export class LowdbProjectModel extends IProjectModel {
//     constructor(config) {
//         super(config);
//         this.db = LowdbManager.db;
//         this.projects = this.db.data.projects;
//         Object.preventExtensions(this);
//     }
//
//     getUserProjects(userId) {
//         userId = Number(userId);
//
//         const projectReferences = this.projects.filter((p) => p.userId === userId);
//         return projectReferences.map((p) => Project.fromReference(p));
//     }
//
//     getById(id) {
//         id = Number(id);
//
//         const projectReference = this.projects.find((p) => p.id === id);
//         return Project.fromReference(projectReference);
//     }
//
//     async create(name, description, userId) {
//         try {
//             let newId = 1;
//             if (this.projects.length > 0) {
//                 newId = this.projects.at(-1).id + 1;
//             }
//
//             const project = Project.createProject(newId, name, description, userId, this.config.path);
//
//             await this.db.update(({projects}) => projects.push(project))
//             return project.id;
//         }
//         catch (error) {
//             throw error;
//         }
//     }
//
//     async update(id, project) {
//         id = Number(id);
//         const projectIndex = this.projects.findIndex((p) => p.id === id);
//
//         await this.db.update(({ projects }) => projects[projectIndex] = project);
//         return project;
//     }
//
//     async delete(id) {
//         id = Number(id);
//
//         const index = this.projects.findIndex((p) => p.id === id);
//
//         if (index === -1) {
//             throw new Error(`Project ${id} does not exist.`);
//         }
//
//         const project = Project.fromReference(this.projects[index]);
//         await project.delete();
//         await this.db.update(({ projects }) => projects.splice(index, 1));
//     }
//
//     getVolume(projectId, volumeId) {
//         return super.getVolume(Number(projectId), Number(volumeId));
//     }
//
//     async addVolume(projectId, name, description){
//         try {
//             projectId = Number(projectId);
//
//             const project = this.getById(projectId);
//
//             if (!Object.hasOwn(project, 'volumes')) {
//                 project.volumes = []
//             }
//
//             let newId = 1;
//
//             if (project.volumes.length > 0) {
//                 newId = project.volumes.at(-1).id + 1;
//             }
//
//             const volume = Volume.createVolume(newId, name, description,
//                 path.join(project.path, project.subfolders.volumes));
//
//             project.volumes.push(volume);
//
//             await this.update(projectId, project);
//             return volume.id;
//         }
//         catch (error) {
//             throw error;
//         }
//     }
//
//     async removeVolume(projectId, volumeId){
//         await super.removeVolume(Number(projectId), Number(volumeId));
//     }
//
//     getRawVolume(projectId, volumeId) {
//         return super.getRawVolume(Number(projectId), Number(volumeId));
//     }
//
//     async addRawVolume(projectId, volumeId, file) {
//         return await super.addRawVolume(Number(projectId), Number(volumeId), file);
//     }
//
//     async removeRawVolume(projectId, volumeId) {
//         await super.removeRawVolume(Number(projectId), Number(volumeId));
//     }
//
//     getSparseLabeledVolume(projectId, volumeId, sparseLabeledVolumeId) {
//         return super.getSparseLabeledVolume(Number(projectId), Number(volumeId), Number(sparseLabeledVolumeId));
//     }
//
//     async addSparseLabeledVolumes(projectId, volumeId, files) {
//         projectId = Number(projectId);
//         volumeId = Number(volumeId);
//         const project = this.getById(projectId);
//         const volume = project.findVolume(volumeId);
//
//         let nextId = 1;
//         if (volume.sparseLabels.length > 0) {
//             nextId = volume.sparseLabels.at(-1).id + 1;
//         }
//
//         let volumeAdded = false;
//
//         try {
//             const {fileNames, filePaths} = await saveData(files,
//                 path.join(volume.path, volume.subfolders.sparseLabels), [".raw"], false);
//             for (let i = 0; i < fileNames.length; i++) {
//                 const newSparseLabeledVolume = SparseLabeledVolume
//                     .createSparseLabeledVolume(nextId, fileNames[i], filePaths[i]);
//                 nextId++;
//                 volume.addSparseLabel(newSparseLabeledVolume);
//                 volumeAdded = true;
//             }
//         }
//         catch (error) {
//             throw error;
//         }
//
//         if (!volumeAdded) {
//             throw new Error(`No valid files found.`);
//         }
//         await this.update(projectId, project);
//         console.log("Sparse Labeled Volumes successfully uploaded.");
//     }
//
//     async removeSparseLabeledVolume(projectId, volumeId, sparseLabeledVolumeId) {
//         await super.removeSparseLabeledVolume(Number(projectId), Number(volumeId), Number(sparseLabeledVolumeId));
//     }
//
//     getPseudoLabeledVolume(projectId, volumeId, pseudoLabeledVolumeId) {
//         return super.getPseudoLabeledVolume(Number(projectId), Number(volumeId), Number(pseudoLabeledVolumeId));
//     }
//
//     async addPseudoLabeledVolumes(projectId, volumeId, files) {
//         projectId = Number(projectId);
//         volumeId = Number(volumeId);
//         const project = this.getById(projectId);
//         const volume = project.findVolume(volumeId);
//
//         let nextId = 1;
//         if (volume.pseudoLabels.length > 0) {
//             nextId = volume.pseudoLabels.at(-1).id + 1;
//         }
//
//         let volumeAdded = false;
//
//         try {
//             const {fileNames, filePaths} = await saveData(files,
//                 path.join(volume.path, volume.subfolders.pseudoLabels), [".raw"], false);
//             for (let i = 0; i < fileNames.length; i++) {
//                 const newPseudoLabeledVolume = PseudoLabeledVolume
//                     .createPseudoLabeledVolume(nextId, fileNames[i], filePaths[i]);
//                 volume.addPseudoLabel(newPseudoLabeledVolume);
//                 nextId++;
//                 volumeAdded = true;
//             }
//         }
//         catch (error) {
//             throw error;
//         }
//
//         if (!volumeAdded) {
//             throw new Error(`No valid files found.`);
//         }
//         await this.update(projectId, project);
//         console.log("Pseudo Labeled Volumes successfully uploaded.");
//     }
//
//     async removePseudoLabeledVolume(projectId, volumeId, pseudoLabeledVolumeId) {
//         await super.removePseudoLabeledVolume(Number(projectId), Number(volumeId), Number(pseudoLabeledVolumeId));
//     }
//
//     getModel(projectId, modelId) {
//         return super.getModel(Number(projectId), Number(modelId));
//     }
//
//     async addModel(projectId, name, description) {
//         try {
//             projectId = Number(projectId);
//             const project = this.getById(projectId);
//             if (!Object.hasOwn(project, 'models')) {
//                 project.models = []
//             }
//
//             let newId = 1;
//
//             if (project.models.length > 0) {
//                 newId = project.models.at(-1).id + 1;
//             }
//
//             const model = Model.createModel(newId, name, description,
//                 path.join(project.path, project.subfolders.models));
//
//             project.models.push(model);
//             await this.update(projectId, project);
//             return model.id;
//         }
//         catch (error) {
//             throw error;
//         }
//     }
//
//     async removeModel(projectId, modelId) {
//         await super.removeModel(Number(projectId), Number(modelId));
//     }
// }