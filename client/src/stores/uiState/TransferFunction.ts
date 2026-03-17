import type { Instance, SnapshotIn } from "mobx-state-tree";
import { getParentOfType, types } from "mobx-state-tree";
import { v4 as uuidv4 } from "uuid";
import { clamp } from "@/utils/helpers";
import Color from "color";

export const MAX_BREAKPOINTS = 10;
export const MIN_BREAKPOINTS = 1;
export const MIN_DISTANCE_BETWEEN_BREAKPOINTS = 0.001;

export const TransferFunctionBreakpoint = types
  .model("Transfer Function Breakpoint", {
    id: types.optional(types.identifier, () => uuidv4()),
    position: types.number,
    color: types.string, // Hex color string, e.g., "#ff0000"
  })
  .views((self) => ({
    get transferFunction(): TransferFunctionInstance {
      return getParentOfType(self, TransferFunction);
    },
    get hsv() {
      const color = Color(self.color).hsv();
      return {
        h: color.hue(),
        s: color.saturationv() / 100,
        v: color.value() / 100,
        a: color.alpha(),
      };
    },
  }))
  .actions((self) => ({
    setPosition(position: number) {
      self.position = clamp(position, 0, 1);
    },
    setColor(color: string) {
      self.color = color;
    },
    setHSV(hue: number, saturation: number, value: number, alpha: number = 1) {
      const color = Color.hsv(hue, saturation * 100, value * 100).alpha(alpha);
      self.color = color.hexa();
    },
    setAlpha(alpha: number) {
      const color = Color(self.color).alpha(alpha);
      self.color = color.hexa();
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
    addBreakpoint(breakpoint: TransferFunctionBreakpointSnapshotIn) {
      if (!self.canAddBreakpoint) {
        throw new Error(`Maximum of ${MAX_BREAKPOINTS} breakpoints reached.`);
      }
      breakpoint.position = clamp(breakpoint.position, 0, 1);
      return self.breakpoints.put(breakpoint);
    },
    removeBreakpoint(id: string) {
      if (!self.canDeleteBreakpoint) {
        throw new Error(
          `At least ${MIN_BREAKPOINTS} breakpoint(s) must remain.`
        ); // Ensure at least one breakpoint remains
      }
      self.breakpoints.delete(id);
    },
  }));

export interface TransferFunctionInstance extends Instance<
  typeof TransferFunction
> {}
export interface TransferFunctionSnapshotIn extends SnapshotIn<
  typeof TransferFunction
> {}
