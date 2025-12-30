import {
  getParentOfType,
  type Instance,
  type SnapshotIn,
} from "mobx-state-tree";
import { types } from "mobx-state-tree";
import type { RenderingParameters } from "../../renderer/renderingParametersBuffer";
import {
  type RendererCameraParameters,
  type VolumeRenderer,
} from "../../renderer/renderer";
import { RootStore } from "../RootStore";
import { clamp } from "../../renderer/utilities/math";

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
    shadowMin: types.optional(types.number, 0),
    shadowMax: types.optional(types.number, 1),
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
      self.renderer?.renderingParameters.set({
        clearColor: [r / 255, g / 255, b / 255, 1],
      });
    },
    setSampleRate(rate: number) {
      self.sampleRate = rate;
      self.renderer?.renderingParameters.set({
        sampleRate: self.sampleRate,
      });
    },
    setEarlyRayTermination(state: boolean) {
      self.enableEarlyRayTermination = state;
      self.renderer?.renderingParameters.set({
        enableEarlyRayTermination: self.enableEarlyRayTermination,
      });
    },
    setJittering(state: boolean) {
      self.enableJittering = state;
      self.renderer?.renderingParameters.set({
        enableJittering: self.enableJittering,
      });
    },
    setAmbientOcclusion(state: boolean) {
      self.enableAmbientOcclusion = state;
      self.renderer?.renderingParameters.set({
        enableAmbientOcclusion: self.enableAmbientOcclusion,
      });
    },
    setAoRadius(radius: number) {
      self.aoRadius = radius;
      self.renderer?.renderingParameters.set({
        aoRadius: self.aoRadius,
      });
    },
    setAoStrength(strength: number) {
      self.aoStrength = strength;
      self.renderer?.renderingParameters.set({
        aoStrength: self.aoStrength,
      });
    },
    setAoNumSamples(samples: number) {
      self.aoNumSamples = samples;
      self.renderer?.renderingParameters.set({
        aoNumSamples: self.aoNumSamples,
      });
    },
    setSoftShadows(state: boolean) {
      self.enableSoftShadows = state;
      self.renderer?.renderingParameters.set({
        enableSoftShadows: self.enableSoftShadows,
      });
    },
    setShadowQuality(quality: number) {
      self.shadowQuality = quality;
      self.renderer?.renderingParameters.set({
        shadowQuality: self.shadowQuality,
      });
    },
    setShadowStrength(strength: number) {
      self.shadowStrength = strength;
      self.renderer?.renderingParameters.set({
        shadowStrength: self.shadowStrength,
      });
    },
    setShadowRadius(radius: number) {
      self.shadowRadius = radius;
      self.renderer?.renderingParameters.set({
        shadowRadius: self.shadowRadius,
      });
    },
    setShadowMin(threshold: number) {
      threshold = clamp(threshold, 0, 1);
      self.shadowMin = threshold;
      if (self.shadowMin > self.shadowMax) {
        self.shadowMax = threshold;
      }
    },
    setShadowMax(threshold: number) {
      threshold = clamp(threshold, 0, 1);
      self.shadowMax = threshold;
      if (self.shadowMax < self.shadowMin) {
        self.shadowMin = threshold;
      }
    },
    getRendererParameters(): Partial<RenderingParameters> {
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
        shadowMin: self.shadowMin,
        shadowMax: self.shadowMax,

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
