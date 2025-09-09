import { flow, Instance, SnapshotIn, types } from "mobx-state-tree";
import * as Utils from "../../utils/Helpers";
import { updateVolumeData } from "../../api/volumeData";
import ToastContainer from "../../utils/ToastContainer";
import { sparseLabelVolumeDataSchema } from "#schemas/componentSchemas/sparse-label-volume-data-schema.mjs";
import z from "zod";

export const SparseLabelVolume = types
  .model({
    id: types.identifierNumber,
    path: types.maybeNull(types.string),
    creatorId: types.maybeNull(types.integer),
    rawFilePath: types.maybeNull(types.string),
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
  })
  .actions((self) => ({
    setColor: flow(function* setColor(
      color: string,
      index: number
    ): Generator<any, void, any> {
      const toastContainer = new ToastContainer();
      try {
        toastContainer.loading("Updating label color...");
        const sparselabel: z.infer<typeof sparseLabelVolumeDataSchema> =
          yield updateVolumeData("SparseLabeledVolumeData", self.id, {
            color: color,
          });

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

        toastContainer.dismiss();
      } catch (error) {
        toastContainer.error(Utils.getErrorMessage(error));
      }
    }),
  }));

export interface SparseVolumeInstance
  extends Instance<typeof SparseLabelVolume> {}
export interface SparseVolumeSnapshotIn
  extends SnapshotIn<typeof SparseLabelVolume> {}
