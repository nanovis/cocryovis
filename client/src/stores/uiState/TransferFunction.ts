import {
  Instance,
  SnapshotIn,
  types,
  getParentOfType,
  flow,
  isAlive,
} from "mobx-state-tree";
import { VolVisSettings } from "./VolVisSettings";
import * as Utils from "../../utils/Helpers";

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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

      const fileContent: string = yield Utils.readFileAsText(file);
      if (!isAlive(self)) {
        return;
      }
      const newTransferFunction = JSON.parse(fileContent);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (Object.hasOwn(newTransferFunction, "rampLow")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof newTransferFunction.rampLow !== "number") {
          throw new Error("Missdefined rampLow format.");
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        self.rampLow = newTransferFunction.rampLow;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (Object.hasOwn(newTransferFunction, "rampHigh")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof newTransferFunction.rampHigh !== "number") {
          throw new Error("Missdefined rampHigh format.");
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        self.rampHigh = newTransferFunction.rampHigh;
      }
      if (self.rampLow > self.rampHigh) {
        self.rampLow = self.rampHigh;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (Object.hasOwn(newTransferFunction, "color")) {
        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          typeof newTransferFunction.color !== "object" ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
          !Object.hasOwn(newTransferFunction.color, "x") ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
          !Object.hasOwn(newTransferFunction.color, "y") ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
          !Object.hasOwn(newTransferFunction.color, "z")
        ) {
          throw new Error("Missdefined color format.");
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        self.red = newTransferFunction.color.x;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        self.green = newTransferFunction.color.y;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        self.blue = newTransferFunction.color.z;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      if (Object.hasOwn(newTransferFunction, "comment")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        self.comment = newTransferFunction.comment;
      }

      self.updateRenderer();
    }),
  }));

export interface TransferFunctionInstance extends Instance<
  typeof TransferFunction
> {}
export interface TransferFunctionSnapshotIn extends SnapshotIn<
  typeof TransferFunction
> {}
