// export class IModelModel {
//     constructor(config) {
//         if(this.constructor === IProjectModel) {
//             throw new Error("Class is of abstract type and can't be instantiated");
//         }
//         this.config = config;
//         if (this.config === undefined) {
//             throw new Error("Missing projects config");
//         }
//     }
//
//     getUserProjects(userId) {
//         throw new Error('Method not implemented');
//     }
//
//     getById(id) {
//         throw new Error('Method not implemented');
//     }
//
//     async create(project) {
//         throw new Error('Method not implemented');
//     }
//
//     async update(id, project) {
//         throw new Error('Method not implemented');
//     }
//
//     async delete(id) {
//         throw new Error('Method not implemented');
//     }
//
//     getModel(projectId, modelId) {
//         return this.getById(projectId).findModel(modelId);
//     }
//
//     async addModel(projectId, name, description) {
//         throw new Error('Method not implemented');
//     }
//
//     async removeModel(projectId, modelId) {
//         try {
//             const project = this.getById(projectId);
//
//             await project.removeModel(modelId);
//             await this.update(projectId, project);
//             console.log(`Model ${modelId} successfully deleted.`);
//         }
//         catch (error) {
//             throw error;
//         }
//     }
// }