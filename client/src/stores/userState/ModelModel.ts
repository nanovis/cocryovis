import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, isAlive, types } from "mobx-state-tree";
import type {
  CheckpointInstance,
  CheckpointWithModelComboboxOption,
} from "./CheckpointModel";
import { ModelCheckpoints } from "./CheckpointModel";
import type z from "zod";
import type {
  modelSchema,
  modelSchemaWithCheckpoint,
  modelSchemaWithOptionalCheckpoint,
} from "@cocryovis/schemas/componentSchemas/model-schema";
import * as modelApi from "@/api/models";
import type { ComboboxOption } from "@/components/shared/ComboboxSearch";

export type ModelDB = z.infer<typeof modelSchemaWithOptionalCheckpoint>;

export interface ModelComboboxOption extends ComboboxOption {
  description: string;
}

export const Model = types
  .model({
    id: types.identifierNumber,
    name: types.string,
    description: types.string,
    creatorId: types.maybeNull(types.integer),
    modelCheckpoints: ModelCheckpoints,
  })
  .views((self) => ({
    get comboboxOption(): ModelComboboxOption {
      return {
        value: self.id.toString(),
        description: self.description,
        children: self.name,
      };
    },
  }));

export interface ModelInstance extends Instance<typeof Model> {}
export interface ModelSnapshotIn extends SnapshotIn<typeof Model> {}

export const ProjectModels = types
  .model({
    projectId: types.identifierNumber,
    models: types.map(Model),
    selectedModelId: types.maybe(types.integer),
  })
  .volatile(() => ({
    createModelActiveRequest: false,
    deleteModelActiveRequest: false,
  }))
  .views((self) => ({
    get selectedModel() {
      return self.selectedModelId
        ? self.models.get(self.selectedModelId)
        : undefined;
    },
    get modelComboboxOptions(): ModelComboboxOption[] {
      return Array.from(self.models.values()).map(
        (model) => model.comboboxOption
      );
    },
    get uniqueCheckpoints() {
      const checkpoints = new Map<
        number,
        { checkpoint: CheckpointInstance; model: ModelInstance }
      >();
      self.models.forEach((model) => {
        model.modelCheckpoints.checkpoints.forEach((checkpoint) => {
          checkpoints.set(checkpoint.id, { checkpoint, model });
        });
      });
      return checkpoints;
    },
    get checkpointsComboboxOptions(): CheckpointWithModelComboboxOption[] {
      return Array.from(this.uniqueCheckpoints.values()).map(
        ({ checkpoint, model }) => ({
          ...checkpoint.comboboxOption,
          modelName: model.name,
        })
      );
    },
  }))
  .actions((self) => ({
    setCreateModelActiveRequest(active: boolean) {
      self.createModelActiveRequest = active;
    },
    setDeleteModelActiveRequest(active: boolean) {
      self.deleteModelActiveRequest = active;
    },
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
      self.setCreateModelActiveRequest(true);
      const model = (yield modelApi.createModel(self.projectId, {
        name: name,
        description: description,
      })) as z.infer<typeof modelSchema>;

      if (!isAlive(self)) {
        return;
      }

      self.addModel(model);
      self.selectedModelId = model.id;
      return model;
    }),
    removeModel: flow(function* removeModel(modelId: number) {
      self.setDeleteModelActiveRequest(true);
      yield modelApi.deleteModel(modelId);
      if (!isAlive(self)) {
        return;
      }

      self.models.delete(modelId.toString());

      if (self.selectedModelId === modelId) {
        self.selectedModelId = undefined;
      }
    }),
  }))
  .actions((self) => ({
    refreshModels: flow(function* refreshModels() {
      const models = (yield modelApi.getModelsFromProjectWithCheckpoints(
        self.projectId
      )) as z.infer<typeof modelSchemaWithCheckpoint>[];

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
