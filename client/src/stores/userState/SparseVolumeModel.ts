import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, types } from "mobx-state-tree";
import * as Utils from "../../utils/Helpers";
import { updateVolumeData } from "../../api/volumeData";
import ToastContainer from "../../utils/ToastContainer";
import type { sparseLabelVolumeDataSchema } from "#schemas/componentSchemas/sparse-label-volume-data-schema.mjs";
import type z from "zod";

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
  .actions((self) => ({
    updateName: flow(function* updateName(name: string) {
      const sparselabel: z.infer<typeof sparseLabelVolumeDataSchema> =
        yield updateVolumeData("SparseLabeledVolumeData", self.id, {
          name: name,
        });
      self.name = sparselabel.name;
    }),
    setColor: flow(function* setColor(
      color: string,
      index: number
    ): Generator<any, void> {
      const toastContainer = new ToastContainer();
      try {
        toastContainer.loading("Updating label color...");
        const sparselabel: z.infer<typeof sparseLabelVolumeDataSchema> =
          yield updateVolumeData("SparseLabeledVolumeData", self.id, {
            color: color,
          });

        self.color = sparselabel.color;

        if (window.WasmModule && self.color) {
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

export interface SparseVolumeInstance extends Instance<
  typeof SparseLabelVolume
> {}
export interface SparseVolumeSnapshotIn extends SnapshotIn<
  typeof SparseLabelVolume
> {}
