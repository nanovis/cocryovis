import {
  Instance,
  SnapshotIn,
  types,
  getParentOfType,
  flow,
  isAlive,
} from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import Utils from "../../utils/Helpers";

export const TransferFunction = types
  .model({
    rampLow: types.number,
    rampHigh: types.number,
    red: types.integer,
    green: types.integer,
    blue: types.integer,
    comment: types.string,
  })
  .views((self) => ({
    get color() {
      return Utils.toHexColor(self.red, self.green, self.blue);
    },
  }))
  .actions((self) => ({
    updateRenderer() {
      window.WasmModule?.adjustTransferFunction(
        getParentOfType(self, VolVisSettings).index,
        self.rampLow,
        self.rampHigh,
        self.red,
        self.blue,
        self.green
      );
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
    setValues(values: Partial<Record<keyof typeof self, any>>) {
      Object.keys(values).forEach((key) => {
        if (key in self) {
          (self as any)[key] = values[key as keyof typeof values];
        }
      });
      self.updateRenderer();
    },
    handleTFUpload: flow(function* handleTFUpload(files: FileList | null) {
      if (!files || files.length < 1) {
        return;
      }

      const file = files[0];

      if (!file.name.endsWith(".json")) {
        throw new Error("Wrong file format.");
      }

      const fileContent = yield Utils.readFileAsText(file);
      if (!isAlive(self)) {
        return;
      }
      const newTransferFunction = JSON.parse(fileContent);

      if (Object.hasOwn(newTransferFunction, "rampLow")) {
        if (typeof newTransferFunction.rampLow !== "number") {
          throw new Error("Missdefined rampLow format.");
        }
        self.rampLow = newTransferFunction.rampLow;
      }
      if (Object.hasOwn(newTransferFunction, "rampHigh")) {
        if (typeof newTransferFunction.rampHigh !== "number") {
          throw new Error("Missdefined rampHigh format.");
        }
        self.rampHigh = newTransferFunction.rampHigh;
      }
      if (self.rampLow > self.rampHigh) {
        self.rampLow = self.rampHigh;
      }
      if (Object.hasOwn(newTransferFunction, "color")) {
        if (
          typeof newTransferFunction.color !== "object" ||
          !Object.hasOwn(newTransferFunction.color, "x") ||
          !Object.hasOwn(newTransferFunction.color, "y") ||
          !Object.hasOwn(newTransferFunction.color, "z")
        ) {
          throw new Error("Missdefined color format.");
        }
        self.red = newTransferFunction.color.x;
        self.green = newTransferFunction.color.y;
        self.blue = newTransferFunction.color.z;
      }
      if (Object.hasOwn(newTransferFunction, "comment")) {
        self.comment = newTransferFunction.comment;
      }

      self.updateRenderer();
    }),
  }));

export interface TransferFunctionInstance
  extends Instance<typeof TransferFunction> {}
export interface TransferFunctionSnapshotIn
  extends SnapshotIn<typeof TransferFunction> {}
