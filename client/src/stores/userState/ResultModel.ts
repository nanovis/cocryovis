import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, isAlive, types } from "mobx-state-tree";
import { Checkpoint } from "./CheckpointModel";
import type { getResultSchema } from "@cocryovis/schemas/result-path-schema";
import type z from "zod";
import { getResultsFromVolume, deleteResult } from "@/api/results";
import type { ComboboxOption } from "@/components/shared/ComboboxSearch";
import { getFileNameFromPath } from "@/utils/helpers";

export interface ResultComboboxOption extends ComboboxOption {
  checkpoint: string;
}

export const Result = types
  .model({
    id: types.identifierNumber,
    folderPath: types.maybeNull(types.string),
    files: types.maybeNull(types.string),
    rawVolumeChannel: types.maybeNull(types.integer),
    logFile: types.maybeNull(types.string),
    creatorId: types.maybeNull(types.integer),
    checkpoint: types.maybeNull(Checkpoint),
    volumeId: types.integer,
  })
  .views((self) => ({
    get comboboxOption(): ResultComboboxOption {
      return {
        value: self.id.toString(),
        children: `Result ${self.id}`,
        checkpoint: getFileNameFromPath(self.checkpoint?.filePath) ?? "",
      };
    },
  }));

export interface ResultInstance extends Instance<typeof Result> {}
export interface ResultSnapshotIn extends SnapshotIn<typeof Result> {}

export const VolumeResults = types
  .model({
    volumeId: types.identifierNumber,
    results: types.map(Result),
    selectedResultId: types.maybe(types.integer),
  })
  .volatile(() => ({
    removeResultActiveRequest: false,
  }))

  .views((self) => ({
    get selectedResult() {
      return self.selectedResultId
        ? self.results.get(self.selectedResultId)
        : undefined;
    },
    get resultComboboxOptions(): ResultComboboxOption[] {
      return Array.from(self.results.values()).map(
        (result) => result.comboboxOption
      );
    },
  }))
  .actions((self) => ({
    setRemoveResultActiveRequest(active: boolean) {
      self.removeResultActiveRequest = active;
    },
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
      yield deleteResult(resultId);
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
      const results = (yield getResultsFromVolume(self.volumeId)) as z.infer<
        typeof getResultSchema
      >;

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
