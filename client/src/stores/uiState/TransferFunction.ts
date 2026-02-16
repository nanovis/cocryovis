import type { Instance, SnapshotIn } from "mobx-state-tree";
import { types, getParentOfType, flow, isAlive } from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import * as Utils from "../../utils/helpers";
import type { VolumeRenderer } from "@/renderer/renderer";
import { RootStore } from "../RootStore";
import { transferFunctionSchema } from "@cocryovis/schemas/componentSchemas/volume-settings-schema";

export const TransferFunction = types
  .model({
    rampLow: types.number,
    rampHigh: types.number,
    red: types.integer,
    green: types.integer,
    blue: types.integer,
    comment: types.maybe(types.string),
  })
  .views((self) => ({
    get color() {
      return Utils.toHexColor(self.red, self.green, self.blue);
    },
    get renderer(): VolumeRenderer | null {
      const rootStore = getParentOfType(self, RootStore);
      return rootStore.renderer;
    },
  }))
  .actions((self) => ({
    updateRenderer() {
      const index = getParentOfType(self, VolVisSettings).index;

      self.renderer?.volumeManager.channelData.set(index, {
        rampStart: self.rampLow,
        rampEnd: self.rampHigh,
        color: [self.red / 255, self.green / 255, self.blue / 255, 1],
      });
    },
  }))
  .actions((self) => ({
    setRampLow(value: number) {
      self.rampLow = Math.min(value / 100, self.rampHigh);
      self.updateRenderer();
    },
    setRampHigh(value: number) {
      self.rampHigh = Math.max(self.rampLow, value / 100);
      self.updateRenderer();
    },
    setColor(red: number, green: number, blue: number) {
      self.red = red;
      self.green = green;
      self.blue = blue;
      self.updateRenderer();
    },
    handleTFUpload: flow(function* (file: File) {
      if (!file.name.endsWith(".json")) {
        throw new Error("Wrong file format.");
      }

      const fileContent: string = yield Utils.readFileAsText(file);
      if (!isAlive(self)) {
        return;
      }
      const parsed: unknown = JSON.parse(fileContent);
      const newTransferFunction = transferFunctionSchema.parse(parsed);
      self.rampLow = newTransferFunction.rampLow;
      self.rampHigh = newTransferFunction.rampHigh;
      self.red = newTransferFunction.color.x;
      self.green = newTransferFunction.color.y;
      self.blue = newTransferFunction.color.z;
      self.comment = newTransferFunction.comment;

      self.updateRenderer();
    }),
  }));

export interface TransferFunctionInstance extends Instance<
  typeof TransferFunction
> {}
export interface TransferFunctionSnapshotIn extends SnapshotIn<
  typeof TransferFunction
> {}
