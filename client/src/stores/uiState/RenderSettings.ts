import { Instance, SnapshotIn, types } from "mobx-state-tree";

export const RenderSettings = types
  .model({
    nearPlane: types.optional(types.number, 0.01),
    farPlane: types.optional(types.number, 100),
    clearColor: types.optional(types.array(types.number), [0, 0, 0]),
    sampleRate: types.optional(types.number, 5),
    earlyRayTermination: types.optional(types.boolean, true),
    enableJittering: types.optional(types.boolean, true),
    enablePostProcessing: types.optional(types.boolean, true),
    enableAmbientOcclusion: types.optional(types.boolean, true),
    aoRadius: types.optional(types.number, 1),
    aoNumSamples: types.optional(types.integer, 5),
    aoStrength: types.optional(types.number, 0.9),
    enableSoftShadows: types.optional(types.boolean, true),
    shadowQuality: types.optional(types.number, 1),
    shadowStrength: types.optional(types.number, 0.5),
    shadowRadius: types.optional(types.number, 0.2),
  })
  .actions((self) => ({
    setNearPlane(nearPlane: number) {
      self.nearPlane = nearPlane;
      window.WasmModule?.set_near_plane(nearPlane);
    },
    setFarPlane(farPlane: number) {
      self.farPlane = farPlane;
      window.WasmModule?.set_far_plane(farPlane);
    },
    setClearColor(r: number, g: number, b: number) {
      self.clearColor.replace([r, g, b]);
      window.WasmModule?.setColor(r / 255, g / 255, b / 255);
    },
    setSampleRate(rate: number) {
      self.sampleRate = rate;
      window.WasmModule?.set_sample_rate(rate);
    },
    setEarlyRayTermination(state: boolean) {
      self.earlyRayTermination = state;
      window.WasmModule?.enable_early_ray_termination(state);
    },
    setJittering(state: boolean) {
      self.enableJittering = state;
      window.WasmModule?.enable_jittering(state);
    },
    setPostProcessing(state: boolean) {
      self.enablePostProcessing = state;
      window.WasmModule?.enable_post_processing(state);
    },
    setAmbientOcclusion(state: boolean) {
      self.enableAmbientOcclusion = state;
      window.WasmModule?.enableAO(state);
    },
    setAoRadius(radius: number) {
      self.aoRadius = radius;
      window.WasmModule?.set_ao_radius(radius);
    },
    setAoStrength(strength: number) {
      self.aoStrength = strength;
      window.WasmModule?.set_ao_strength(strength);
    },
    setAoNumSamples(samples: number) {
      self.aoNumSamples = samples;
      window.WasmModule?.set_ao_samples(samples);
    },
    setSoftShadows(state: boolean) {
      self.enableSoftShadows = state;
      window.WasmModule?.enable_soft_shadows(state);
    },
    setShadowQuality(quality: number) {
      self.shadowQuality = quality;
      window.WasmModule?.set_shadow_quality(quality);
    },
    setShadowStrength(strength: number) {
      self.shadowStrength = strength;
      window.WasmModule?.set_shadow_strength(strength);
    },
    setShadowRadius(radius: number) {
      self.shadowRadius = radius;
      window.WasmModule?.set_shadow_radius(radius);
    },
  }));

export interface RenderSettingsInstance extends Instance<
  typeof RenderSettings
> {}
export interface RenderSettingsSnapshotIn extends SnapshotIn<
  typeof RenderSettings
> {}
