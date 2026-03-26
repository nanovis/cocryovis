import type { Instance, SnapshotIn } from "mobx-state-tree";
import { getParentOfType, types } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { clamp, downloadBlob } from "@/utils/helpers";
import Color from "color";
import { VolVisSettings } from "./VolVisSettings";
import { transferFunctionSchema } from "@cocryovis/schemas/componentSchemas/volume-settings-schema";

export const MAX_BREAKPOINTS = 20;
export const MIN_BREAKPOINTS = 1;
export const MIN_DISTANCE_BETWEEN_BREAKPOINTS = 0.001;

export function createBreakpointsObject(
  breakpoints: TransferFunctionBreakpointSnapshotIn[]
) {
  return Object.fromEntries(
    breakpoints.map((point) => {
      const id = point.id ?? uuidv4();
      return [id, { ...point, id }];
    })
  );
}

export const TransferFunctionBreakpoint = types
  .model("Transfer Function Breakpoint", {
    id: types.optional(types.identifier, () => uuidv4()),
    position: types.number,
    color: types.string, // Hex/hexa color string, e.g., "#ff0000"
  })
  .volatile((self) => ({
    hue: Color(self.color).hue(),
    saturation: Color(self.color).saturationv() / 100,
    value: Color(self.color).value() / 100,
    alpha: Color(self.color).alpha(),
  }))
  .views((self) => ({
    get transferFunction(): TransferFunctionInstance {
      return getParentOfType(self, TransferFunction);
    },
    get hsv() {
      return {
        h: self.hue,
        s: self.saturation,
        v: self.value,
        a: self.alpha,
      };
    },
    get red() {
      return Color(self.color).red();
    },
    get green() {
      return Color(self.color).green();
    },
    get blue() {
      return Color(self.color).blue();
    },
    get alpha() {
      return Color(self.color).alpha();
    },
  }))
  .actions((self) => ({
    setPosition(position: number) {
      self.position = clamp(position, 0, 1);
      self.transferFunction.updateRenderer();
    },
    setColor(color: string, setHsv = true) {
      try {
        const c = Color(color);
        self.color = c.hexa();
        self.transferFunction.updateRenderer();
        if (setHsv) {
          self.hue = c.hue();
          self.saturation = c.saturationv() / 100;
          self.value = c.value() / 100;
          self.alpha = c.alpha();
        }
      } catch {
        // Invalid color string, ignore the update
      }
    },
    setHSV(hue: number, saturation: number, value: number, alpha: number = 1) {
      try {
        const color = Color.hsv(hue, saturation * 100, value * 100).alpha(
          alpha
        );
        this.setColor(color.hexa(), false);
        self.hue = hue;
        self.saturation = saturation;
        self.value = value;
        self.alpha = alpha;
      } catch {
        // Invalid HSV values, ignore the update
      }
    },
    setRed(red: number) {
      try {
        const color = Color(self.color).red(red);
        this.setColor(color.hexa());
      } catch {
        // Invalid red value, ignore the update
      }
    },
    setGreen(green: number) {
      try {
        const color = Color(self.color).green(green);
        this.setColor(color.hexa());
      } catch {
        // Invalid green value, ignore the update
      }
    },
    setBlue(blue: number) {
      try {
        console.log("Setting blue to", blue);
        const color = Color(self.color).blue(blue);
        this.setColor(color.hexa());
      } catch {
        // Invalid blue value, ignore the update
      }
    },
    setAlpha(alpha: number) {
      try {
        const color = Color(self.color).alpha(alpha);
        this.setColor(color.hexa());
      } catch {
        // Invalid alpha value, ignore the update
      }
    },
  }));

export interface TransferFunctionBreakpointInstance extends Instance<
  typeof TransferFunctionBreakpoint
> {}
export interface TransferFunctionBreakpointSnapshotIn extends SnapshotIn<
  typeof TransferFunctionBreakpoint
> {}

export const TransferFunction = types
  .model("Transfer Function", {
    breakpoints: types.optional(types.map(TransferFunctionBreakpoint), () => {
      const id0 = uuidv4();
      const id1 = uuidv4();
      return {
        [id0]: { id: id0, position: 0, color: "#ffffff00" },
        [id1]: { id: id1, position: 1, color: "#ffffffff" },
      };
    }),
    comment: types.maybe(types.string),
  })
  .views((self) => ({
    get sortedBreakpoints(): Instance<typeof TransferFunctionBreakpoint>[] {
      return Array.from(self.breakpoints.values()).sort(
        (a, b) => a.position - b.position
      );
    },
    get canDeleteBreakpoint() {
      return self.breakpoints.size > MIN_BREAKPOINTS;
    },
    get canAddBreakpoint() {
      return self.breakpoints.size < MAX_BREAKPOINTS;
    },
  }))
  .actions((self) => ({
    updateRenderer() {
      const volVisSettings = getParentOfType(self, VolVisSettings);
      volVisSettings.renderer?.volumeManager.transferFunctionLut.setBreakpoints(
        volVisSettings.index,
        self.sortedBreakpoints.map((point) => ({
          position: point.position,
          color: point.color,
        }))
      );
    },
  }))
  .actions((self) => ({
    addBreakpoint(
      breakpoint: TransferFunctionBreakpointSnapshotIn,
      updateRenderer = true
    ) {
      if (!self.canAddBreakpoint) {
        throw new Error(`Maximum of ${MAX_BREAKPOINTS} breakpoints reached.`);
      }
      breakpoint.position = clamp(breakpoint.position, 0, 1);
      const created = self.breakpoints.put(breakpoint);
      if (updateRenderer) {
        self.updateRenderer();
      }
      return created;
    },
    removeBreakpoint(id: string) {
      if (!self.canDeleteBreakpoint) {
        throw new Error(
          `At least ${MIN_BREAKPOINTS} breakpoint(s) must remain.`
        ); // Ensure at least one breakpoint remains
      }
      self.breakpoints.delete(id);
      self.updateRenderer();
    },
    download() {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              comment: self.comment,
              breakpoints: self.sortedBreakpoints.map((point) => ({
                position: point.position,
                color: point.color,
              })),
            },
            null,
            2
          ),
        ],
        {
          type: "application/json",
        }
      );
      const index = getParentOfType(self, VolVisSettings).index;
      downloadBlob(blob, `transferFunction_${index}.json`);
    },
  }))
  .actions((self) => ({
    fromJsonString(json: string) {
      try {
        const data = transferFunctionSchema.parse(JSON.parse(json));
        self.breakpoints.clear();
        data.breakpoints.forEach(
          (point: TransferFunctionBreakpointSnapshotIn) => {
            self.addBreakpoint(point, false);
          }
        );
        self.comment = data.comment;
      } catch (error) {
        console.error("Failed to upload transfer function:", error);
        throw new Error("Invalid transfer function file.", { cause: error });
      }
    },
  }));

export interface TransferFunctionInstance extends Instance<
  typeof TransferFunction
> {}
export interface TransferFunctionSnapshotIn extends SnapshotIn<
  typeof TransferFunction
> {}
