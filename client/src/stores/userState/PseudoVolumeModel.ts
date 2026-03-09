import type { pseudoLabelVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/pseudo-label-volume-data-schema";
import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, types } from "mobx-state-tree";
import type z from "zod";
import { updateVolumeData } from "@/api/volumeData";

export const PseudoLabelVolume = types
  .model({
    id: types.identifierNumber,
    creatorId: types.maybeNull(types.integer),
    name: types.string,
    sizeX: types.integer,
    sizeY: types.integer,
    sizeZ: types.integer,
    skipBytes: types.integer,
    isLittleEndian: types.boolean,
    isSigned: types.boolean,
    addValue: types.integer,
    bytesPerVoxel: types.integer,
    usedBits: types.integer,
    volumeId: types.integer,
  })
  .actions((self) => ({
    updateName: flow(function* updateName(name: string) {
      const pseudolabel = (yield updateVolumeData(
        "PseudoLabeledVolumeData",
        self.id,
        {
          name: name,
        }
      )) as z.infer<typeof pseudoLabelVolumeDataSchema>;
      self.name = pseudolabel.name;
    }),
  }));

export interface PseudoVolumeInstance extends Instance<
  typeof PseudoLabelVolume
> {}
export interface PseudoVolumeSnapshotIn extends SnapshotIn<
  typeof PseudoLabelVolume
> {}
