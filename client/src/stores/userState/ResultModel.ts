import { flow, Instance, isAlive, SnapshotIn, types } from "mobx-state-tree";
import { Checkpoint } from "./CheckpointModel";
import Utils from "../../functions/Utils";

export const Result = types.model({
  id: types.identifierNumber,
  folderPath: types.maybeNull(types.string),
  files: types.maybeNull(types.string),
  rawVolumeChannel: types.maybeNull(types.integer),
  logFile: types.maybeNull(types.string),
  creatorId: types.maybeNull(types.integer),
  checkpoint: types.maybeNull(Checkpoint),
});

export interface ResultInstance extends Instance<typeof Result> {}
export interface ResultSnapshotIn extends SnapshotIn<typeof Result> {}

export const VolumeResults = types
  .model({
    volumeId: types.identifierNumber,
    results: types.map(Result),
    selectedResultId: types.maybe(types.integer),
  })
  .views((self) => ({
    get selectedResult() {
      return self.selectedResultId
        ? self.results.get(self.selectedResultId)
        : undefined;
    },
  }))
  .actions((self) => ({
    setSelectedResultId(resultId: number) {
      if (!self.results.has(resultId)) {
        throw new Error(`Result with id ${resultId} not found`);
      }
      self.selectedResultId = resultId;
    },
    addResult(result: ResultSnapshotIn) {
      self.results.put(result);
    },
    setResults(results: ResultSnapshotIn[] | undefined) {
      if (!results) return;

      self.results.clear();
      results.forEach((result) => {
        self.results.set(result.id, result);
      });
    },
    removeResult: flow(function* removeResult(resultId: number) {
      yield Utils.sendRequestWithToast(
        `volume/${self.volumeId}/result/${resultId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
        { successText: "Result Successfuly Removed" },
      );
      if (!isAlive(self)) {
        return;
      }

      self.results.delete(resultId.toString());
      if (self.selectedResultId === resultId) {
        self.selectedResultId = undefined;
      }
    }),
  }))
  .actions((self) => ({
    refreshResults: flow(function* refreshResults() {
      const response = yield Utils.sendReq(`/volume/${self.volumeId}/results`, {
        method: "GET",
        credentials: "include",
      });
      if (!isAlive(self)) {
        return;
      }
      const results: ResultSnapshotIn[] = yield response.json();
      if (!isAlive(self)) {
        return;
      }

      self.results.clear();
      self.setResults(results);
      if (self.selectedResultId && !self.results.has(self.selectedResultId)) {
        self.selectedResultId = undefined;
      }
    }),
  }));
