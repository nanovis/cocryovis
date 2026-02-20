import {
  getParentOfType,
  type Instance,
  type SnapshotIn,
} from "mobx-state-tree";
import { flow, types } from "mobx-state-tree";
import * as Utils from "../../utils/helpers";
import { updateVolumeData } from "@/api/volumeData";
import ToastContainer from "../../utils/toastContainer";
import type { sparseLabelVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/sparse-label-volume-data-schema";
import type z from "zod";
import type { VolumeRenderer } from "@/renderer/renderer";
import { RootStore } from "@/stores/RootStore";

export const SparseLabelVolume = types
  .model({
    id: types.identifierNumber,
    creatorId: types.maybeNull(types.integer),
    name: types.string,
    sizeX: types.integer,
    sizeY: types.integer,
    sizeZ: types.integer,
    ratioX: types.number,
    ratioY: types.number,
    ratioZ: types.number,
    skipBytes: types.integer,
    isLittleEndian: types.boolean,
    isSigned: types.boolean,
    addValue: types.integer,
    bytesPerVoxel: types.integer,
    usedBits: types.integer,
    color: types.maybeNull(types.string),
    volumeId: types.integer,
  })
  .views((self) => ({
    get renderer(): VolumeRenderer | null {
      return getParentOfType<typeof RootStore>(self, RootStore).renderer;
    },
  }))
  .actions((self) => ({
    updateName: flow(function* updateName(name: string) {
      const sparselabel = (yield updateVolumeData(
        "SparseLabeledVolumeData",
        self.id,
        {
          name: name,
        }
      )) as z.infer<typeof sparseLabelVolumeDataSchema>;
      self.name = sparselabel.name;
    }),
    setColor: flow(function* setColor(color: string, index: number) {
      const toastContainer = new ToastContainer();
      try {
        toastContainer.loading("Updating label color...");
        const sparselabel = (yield updateVolumeData(
          "SparseLabeledVolumeData",
          self.id,
          {
            color: color,
          }
        )) as z.infer<typeof sparseLabelVolumeDataSchema>;

        self.color = sparselabel.color;

        if (self.renderer) {
          const color = Utils.fromHexColor(self.color ?? "#FFFFFF");
          self.renderer.annotationManager.annotationsDataBuffer.set(index, {
            color: [color.r / 255, color.g / 255, color.b / 255, 1],
          });
        }

        toastContainer.dismiss();
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
      }
    }),
  }));

export interface SparseVolumeInstance extends Instance<
  typeof SparseLabelVolume
> {}
export interface SparseVolumeSnapshotIn extends SnapshotIn<
  typeof SparseLabelVolume
> {}
