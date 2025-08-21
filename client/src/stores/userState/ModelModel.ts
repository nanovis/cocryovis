import { flow, Instance, isAlive, SnapshotIn, types } from "mobx-state-tree";
import { CheckpointInstance, ModelCheckpoints } from "./CheckpointModel";
import * as Utils from "../../utils/Helpers";
import z from "zod";
import {
  modelSchema,
  modelSchemaWithCheckpoint,
  modelSchemaWithOptionalCheckpoint,
} from "#schemas/componentSchemas/model-schema.mjs";
import * as modelApi from "../../api/models";

export type ModelDB = z.infer<typeof modelSchemaWithOptionalCheckpoint>;

export const Model = types.model({
  id: types.identifierNumber,
  name: types.string,
  description: types.string,
  creatorId: types.maybeNull(types.integer),
  modelCheckpoints: ModelCheckpoints,
});

export interface ModelInstance extends Instance<typeof Model> {}
export interface ModelSnapshotIn extends SnapshotIn<typeof Model> {}

export const ProjectModels = types
  .model({
    projectId: types.identifierNumber,
    models: types.map(Model),
    selectedModelId: types.maybe(types.integer),
  })
  .views((self) => ({
    get selectedModel() {
      return self.selectedModelId
        ? self.models.get(self.selectedModelId)
        : undefined;
    },
    get uniqueCheckpoints() {
      const checkpoints = new Map<
        number,
        { checkpoint: CheckpointInstance; models: ModelInstance[] }
      >();
      self.models.forEach((model) => {
        model.modelCheckpoints.checkpoints.forEach((checkpoint) => {
          if (!checkpoints.has(checkpoint.id)) {
            checkpoints.set(checkpoint.id, { checkpoint, models: [] });
          }
          checkpoints.get(checkpoint.id)?.models.push(model);
        });
      });
      return checkpoints;
    },
  }))
  .actions((self) => ({
    addModel(model: ModelDB) {
      self.models.set(model.id, {
        ...model,
        modelCheckpoints: { modelId: model.id },
      });
      self.models
        .get(model.id)
        ?.modelCheckpoints.setCheckpoints(model.checkpoints);
    },
  }))
  .actions((self) => ({
    setSelectedModelId(modelId: number | undefined) {
      if (modelId && !self.models.has(modelId)) {
        throw new Error(`Model with id ${modelId} not found`);
      }
      self.selectedModelId = modelId;
    },
    setModels(models: ModelDB[]) {
      self.models.clear();

      models.forEach((model) => {
        self.addModel(model);
      });
    },
    createModel: flow(function* createModel(name: string, description: string) {
      const model: z.infer<typeof modelSchema> = yield modelApi.createModel(
        self.projectId,
        { name: name, description: description }
      );

      if (!isAlive(self)) {
        return;
      }

      self.addModel(model);
      self.selectedModelId = model.id;

      return model;
    }),
    removeModel: flow(function* removeModel(modelId: number) {
      modelApi.removeModelFromProject(modelId, self.projectId);

      self.models.delete(modelId.toString());

      if (self.selectedModelId === modelId) {
        self.selectedModelId = undefined;
      }
    }),
  }))
  .actions((self) => ({
    refreshModels: flow(function* refreshModels() {
      const models: z.infer<typeof modelSchemaWithCheckpoint>[] =
        yield modelApi.getModelsFromProjectWithCheckpoints(self.projectId);

      if (!isAlive(self)) {
        return;
      }

      self.setModels(models);

      if (self.selectedModelId && !self.models.has(self.selectedModelId)) {
        self.selectedModelId = undefined;
      }
    }),
  }));

export interface ProjectModelsInstance extends Instance<typeof ProjectModels> {}
