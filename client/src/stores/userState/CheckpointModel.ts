import { flow, Instance, isAlive, SnapshotIn, types } from "mobx-state-tree";
import * as Utils from "../../utils/Helpers";
import z from "zod";
import { checkpointSchemaArray } from "#schemas/componentSchemas/checkpoint-schema.mjs";
import * as checkpointApi from "../../api/checkpoint";

export const Checkpoint = types.model({
  id: types.identifierNumber,
  filePath: types.maybeNull(types.string),
  folderPath: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.integer),
});

export interface CheckpointInstance extends Instance<typeof Checkpoint> {}
export interface CheckpointSnapshotIn extends SnapshotIn<typeof Checkpoint> {}

export const ModelCheckpoints = types
  .model({
    modelId: types.identifierNumber,
    checkpoints: types.map(Checkpoint),
    selectedCheckpointId: types.maybe(types.integer),
  })
  .views((self) => ({
    get selectedCheckpoint() {
      return self.selectedCheckpointId
        ? self.checkpoints.get(self.selectedCheckpointId)
        : undefined;
    },
  }))
  .actions((self) => ({
    setSelectedCheckpointId(checkpointId: number | undefined) {
      if (checkpointId && !self.checkpoints.has(checkpointId)) {
        throw new Error(`Checkpoint with id ${checkpointId} not found`);
      }
      self.selectedCheckpointId = checkpointId;
    },
    addCheckpoint(checkpoint: CheckpointSnapshotIn) {
      self.checkpoints.put(checkpoint);
    },
  }))
  .actions((self) => ({
    setCheckpoints(checkpoints: CheckpointSnapshotIn[] | undefined) {
      if (!checkpoints) return;

      self.checkpoints.clear();
      checkpoints.forEach((checkpoint) => {
        self.checkpoints.set(checkpoint.id, checkpoint);
      });
    },
    setSelectedCheckpointId(checkpointId: number | undefined) {
      if (checkpointId && !self.checkpoints.has(checkpointId)) {
        throw new Error(`Checkpoint with id ${checkpointId} not found`);
      }
      self.selectedCheckpointId = checkpointId;
    },
    addCheckpoint(checkpoint: CheckpointSnapshotIn) {
      self.checkpoints.put(checkpoint);
    },
    uploadCheckpoints: flow(function* uploadCheckpoints(
      files: FileList | null
    ) {
      if (!files || files.length == 0) {
        throw new Error("No files silected.");
      }

      for (const file of files) {
        if (!file.name.endsWith(".zip") && !file.name.endsWith(".ckpt")) {
          throw new Error("Wrong file format.");
        }
      }

      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      //LOL fix
      const checkpoints: z.infer<typeof checkpointSchemaArray> =
        yield checkpointApi.uploadCheckpoints(self.modelId, formData);
      if (!isAlive(self)) {
        return;
      }

      for (const checkpoint of checkpoints) {
        self.addCheckpoint(checkpoint);
      }

      if (checkpoints.length > 0) {
        self.selectedCheckpointId = checkpoints[0].id;
        return checkpoints[0];
      }
    }),
    removeCheckpoint: flow(function* removeModel(checkpointId: number) {
      checkpointApi.removeFromModel(self.modelId, checkpointId);

      self.checkpoints.delete(checkpointId.toString());

      if (self.selectedCheckpointId === checkpointId) {
        self.selectedCheckpointId = undefined;
      }
    }),
  }))
  .actions((self) => ({
    refreshCheckpoints: flow(function* refreshCheckpoints() {
      const checkpoints: z.infer<typeof checkpointSchemaArray> =
        yield checkpointApi.getCheckpointsFromModel(self.modelId);
      if (!isAlive(self)) {
        return;
      }

      self.setCheckpoints(checkpoints);

      if (
        self.selectedCheckpointId &&
        !self.checkpoints.has(self.selectedCheckpointId)
      ) {
        self.selectedCheckpointId = undefined;
      }
    }),
  }));

export interface ModelCheckpointsInstance
  extends Instance<typeof ModelCheckpoints> {}
export interface ModelCheckpointsSnapshotIn
  extends SnapshotIn<typeof ModelCheckpoints> {}
