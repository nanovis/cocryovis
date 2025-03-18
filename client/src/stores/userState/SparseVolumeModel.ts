import {
  flow,
  getParentOfType,
  getRoot,
  Instance,
  isAlive,
  SnapshotIn,
  types,
} from "mobx-state-tree";
import { toast } from "react-toastify";
import Utils from "../../functions/Utils";
import { RootInstance } from "../RootStore";
import { Volume } from "./VolumeModel";

async function updateSparseVolume(
  id: number,
  params: Partial<SparseVolumeInstance>
): Promise<SparseVolumeSnapshotIn> {
  const response = await Utils.sendReq(
    `/volumeData/SparseLabeledVolumeData/${id}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    false
  );
  return await response.json();
}

export const SparseLabelVolume = types
  .model({
    id: types.identifierNumber,
    path: types.maybeNull(types.string),
    folderPath: types.maybeNull(types.string),
    creatorId: types.maybeNull(types.integer),
    rawFilePath: types.maybeNull(types.string),
    settings: types.maybeNull(types.string),
    color: types.maybeNull(types.string),
  })
  .actions((self) => ({
    setColor: flow(function* setColor(
      color: string,
      index: number
    ): Generator<any, void, any> {
      let toastId = null;
      try {
        toastId = toast.loading("Updating label color...");
        const sparselabel = yield updateSparseVolume(self.id, {
          color: color,
        });

        const root = getRoot(self) as RootInstance;
        const visualizedVolume = root.uiState.visualizedVolume;
        if (!visualizedVolume || !visualizedVolume.volume) {
          return;
        }
        const volume = getParentOfType(self, Volume);
        if (!volume || volume.id !== visualizedVolume?.volume.id) {
          return;
        }
        self.settings = sparselabel.settings;
        self.color = sparselabel.color;

        if (index !== undefined && window.WasmModule && self.color) {
          const color = Utils.fromHexColor(self.color);
          window.WasmModule.set_annotation_color(
            index,
            color.r / 255,
            color.g / 255,
            color.b / 255
          );
        }

        toast.update(toastId, {
          render: "Label color updated.",
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });
      } catch (e) {
        Utils.updateToastWithErrorMsg(toastId, e);
      }
    }),
  }));

export interface SparseVolumeInstance
  extends Instance<typeof SparseLabelVolume> {}
export interface SparseVolumeSnapshotIn
  extends SnapshotIn<typeof SparseLabelVolume> {}
