import {
  getParentOfType,
  type Instance,
  type SnapshotIn,
} from "mobx-state-tree";
import { types } from "mobx-state-tree";
import type { RendererParameters } from "../../renderer/params.ts";
import {
  type RendererCameraParameters,
  type VolumeRenderer,
} from "../../renderer/renderer.ts";
import { RootStore } from "../RootStore.ts";

export const RenderSettings = types
  .model({
    nearPlane: types.optional(types.number, 0.01),
    farPlane: types.optional(types.number, 100),
    clearColor: types.optional(types.array(types.number), [0, 0, 0]),
    sampleRate: types.optional(types.number, 5),
    enableEarlyRayTermination: types.optional(types.boolean, true),
    enableJittering: types.optional(types.boolean, true),
    enableAmbientOcclusion: types.optional(types.boolean, true),
    aoRadius: types.optional(types.number, 1),
    aoNumSamples: types.optional(types.integer, 5),
    aoStrength: types.optional(types.number, 0.9),
    enableSoftShadows: types.optional(types.boolean, true),
    shadowQuality: types.optional(types.number, 1),
    shadowStrength: types.optional(types.number, 0.5),
    shadowRadius: types.optional(types.number, 0.2),
  })
  .views((self) => ({
    get renderer(): VolumeRenderer | null {
      const rootStore = getParentOfType<typeof RootStore>(self, RootStore);
      return rootStore.renderer;
    },
  }))
  .actions((self) => ({
    setNearPlane(nearPlane: number) {
      self.nearPlane = nearPlane;
      self.renderer?.camera.setParameters({
        near: self.nearPlane,
      });
    },
    setFarPlane(farPlane: number) {
      self.farPlane = farPlane;
      self.renderer?.camera.setParameters({
        far: self.farPlane,
      });
    },
    setClearColor(r: number, g: number, b: number) {
      self.clearColor.replace([r, g, b]);
      self.renderer?.paramData.set({
        clearColor: [r / 255, g / 255, b / 255, 1],
      });
    },
    setSampleRate(rate: number) {
      self.sampleRate = rate;
      self.renderer?.paramData.set({
        sampleRate: self.sampleRate,
      });
    },
    setEarlyRayTermination(state: boolean) {
      self.enableEarlyRayTermination = state;
      self.renderer?.paramData.set({
        enableEarlyRayTermination: self.enableEarlyRayTermination,
      });
    },
    setJittering(state: boolean) {
      self.enableJittering = state;
      self.renderer?.paramData.set({
        enableJittering: self.enableJittering,
      });
    },
    setAmbientOcclusion(state: boolean) {
      self.enableAmbientOcclusion = state;
      self.renderer?.paramData.set({
        enableAmbientOcclusion: self.enableAmbientOcclusion,
      });
    },
    setAoRadius(radius: number) {
      self.aoRadius = radius;
      self.renderer?.paramData.set({
        aoRadius: self.aoRadius,
      });
    },
    setAoStrength(strength: number) {
      self.aoStrength = strength;
      self.renderer?.paramData.set({
        aoStrength: self.aoStrength,
      });
    },
    setAoNumSamples(samples: number) {
      self.aoNumSamples = samples;
      self.renderer?.paramData.set({
        aoNumSamples: self.aoNumSamples,
      });
    },
    setSoftShadows(state: boolean) {
      self.enableSoftShadows = state;
      self.renderer?.paramData.set({
        enableSoftShadows: self.enableSoftShadows,
      });
    },
    setShadowQuality(quality: number) {
      self.shadowQuality = quality;
      self.renderer?.paramData.set({
        shadowQuality: self.shadowQuality,
      });
    },
    setShadowStrength(strength: number) {
      self.shadowStrength = strength;
      self.renderer?.paramData.set({
        shadowStrength: self.shadowStrength,
      });
    },
    setShadowRadius(radius: number) {
      self.shadowRadius = radius;
      self.renderer?.paramData.set({
        shadowRadius: self.shadowRadius,
      });
    },
    getRendererParameters(): Partial<RendererParameters> {
      return {
        enableEarlyRayTermination: self.enableEarlyRayTermination,
        enableJittering: self.enableJittering,
        enableAmbientOcclusion: self.enableAmbientOcclusion,
        enableSoftShadows: self.enableSoftShadows,

        sampleRate: self.sampleRate,
        aoRadius: self.aoRadius,
        aoStrength: self.aoStrength,

        aoNumSamples: self.aoNumSamples,
        shadowQuality: self.shadowQuality,
        shadowStrength: self.shadowStrength,

        clearColor: [...self.clearColor, 1],

        shadowRadius: self.shadowRadius,
      };
    },
    getCameraParameters(): Partial<RendererCameraParameters> {
      return {
        near: self.nearPlane,
        far: self.farPlane,
      };
    },
  }));

export interface RenderSettingsInstance extends Instance<
  typeof RenderSettings
> {}
export interface RenderSettingsSnapshotIn extends SnapshotIn<
  typeof RenderSettings
> {}
