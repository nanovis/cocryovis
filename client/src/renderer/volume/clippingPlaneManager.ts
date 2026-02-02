import { ClippingParametersBuffer } from "./clippingParametersBuffer";
import { mat4, vec3, vec4 } from "gl-matrix";
import { clamp } from "../utilities/math";
import type { Camera } from "../core/camera";
import type { VolumeManager } from "./volumeManager";

export type ClippingPlaneType = "view-aligned" | "x" | "y" | "z" | "none";

export class ClippingPlaneManager {
  clippingParametersBuffer: ClippingParametersBuffer;

  private camera: Camera;
  private volumeManager: VolumeManager;

  private clippingPlaneUp: vec3 = vec3.create();
  private clippingPlaneType: ClippingPlaneType = "none";
  private clippingPlaneOffset: number = 0;

  private fullscreen: boolean = false;

  private lastClippingPlaneOriginUpdate:
    | undefined
    | { normal: vec3; offset: number };

  private lastViewDirection: undefined | vec3;

  constructor(device: GPUDevice, camera: Camera, volumeManager: VolumeManager) {
    this.camera = camera;
    this.volumeManager = volumeManager;
    this.clippingParametersBuffer = new ClippingParametersBuffer(device);
  }

  getClippingPlaneType() {
    return this.clippingPlaneType;
  }

  setClippingPlane(type: ClippingPlaneType) {
    if (this.clippingPlaneType === type) return;
    this.clippingPlaneType = type;
    this.clippingParametersBuffer.set({ clippingEnabled: type !== "none" });

    if (type === "x") {
      this.clippingPlaneUp = vec3.fromValues(0, 1, 0);
      this.clippingParametersBuffer.set({
        clippingPlaneNormal: [1, 0, 0, 0],
      });
    } else if (type === "y") {
      this.clippingPlaneUp = vec3.fromValues(1, 0, 0);
      this.clippingParametersBuffer.set({
        clippingPlaneNormal: [0, 1, 0, 0],
      });
    } else if (type === "z") {
      this.clippingPlaneUp = vec3.fromValues(0, 1, 0);
      this.clippingParametersBuffer.set({
        clippingPlaneNormal: [0, 0, -1, 0],
      });
    }
  }

  setClippingPlaneOffset(offset: number) {
    this.clippingPlaneOffset = clamp(offset, -1, 1);
  }

  setFullscreen(fullscreen: boolean) {
    if (this.fullscreen === fullscreen) return;
    this.fullscreen = fullscreen;

    if (this.fullscreen) {
      this.camera.saveCameraView("fullscreen");
    } else {
      this.camera.restoreCameraView("fullscreen");
    }
  }

  updateClippingPlane() {
    if (this.clippingPlaneType === "view-aligned") {
      const viewDirection = this.camera.getViewVector();
      if (
        this.lastViewDirection === undefined ||
        !vec3.equals(this.lastViewDirection, viewDirection)
      ) {
        const inverseModelMatrix = mat4.create();
        const normal = vec4.create();
        const up = vec4.create();

        const viewVector: vec4 = [...viewDirection, 0];
        const upVector: vec4 = [...this.camera.up, 0];

        vec4.transformMat4(normal, viewVector, inverseModelMatrix);
        vec3.normalize(normal, normal);

        vec4.transformMat4(up, upVector, inverseModelMatrix);
        vec3.normalize(up, up);

        const dot = Math.abs(vec3.dot(normal, up));

        if (dot > 0.99 || dot < 0.01) {
          // Pick fallback axis (X-axis)
          const right = vec4.create();
          vec3.cross(right, normal, vec3.fromValues(1, 0, 0));
          vec3.normalize(right, right);

          vec3.cross(up, right, normal);
          vec3.normalize(up, up);
        }

        this.clippingParametersBuffer.set({
          clippingPlaneNormal: normal,
        });
        this.clippingPlaneUp = up;
        this.lastViewDirection = vec3.clone(viewDirection);
      }
    }

    if (
      this.clippingPlaneType !== "none" &&
      this.volumeManager.channelData.length > 0
    ) {
      const clippingPlaneNormal =
        this.clippingParametersBuffer.params.clippingPlaneNormal;
      if (
        this.lastClippingPlaneOriginUpdate === undefined ||
        !vec3.equals(
          this.lastClippingPlaneOriginUpdate.normal,
          clippingPlaneNormal
        ) ||
        this.lastClippingPlaneOriginUpdate.offset !== this.clippingPlaneOffset
      ) {
        const clippingPlaneOrigin = vec3.create();
        const ratio = this.volumeManager.channelData.get(0).ratio;
        vec3.multiply(clippingPlaneOrigin, clippingPlaneNormal, ratio);
        vec3.scale(
          clippingPlaneOrigin,
          clippingPlaneOrigin,
          this.clippingPlaneOffset
        );
        this.lastClippingPlaneOriginUpdate = {
          normal: vec3.clone(clippingPlaneNormal),
          offset: this.clippingPlaneOffset,
        };
        this.clippingParametersBuffer.set({
          clippingPlaneOrigin: clippingPlaneOrigin,
        });
      }
    }

    if (this.fullscreen && this.volumeManager.channelData.length > 0) {
      const clippingPlaneNormal =
        this.clippingParametersBuffer.params.clippingPlaneNormal;
      const clippingPlaneOrigin =
        this.clippingParametersBuffer.params.clippingPlaneOrigin;

      const ratio = this.volumeManager.channelData.get(0);
      this.camera.setFullscreen(
        this.clippingPlaneUp,
        clippingPlaneNormal,
        clippingPlaneOrigin,
        ratio.ratio
      );
    }
  }

  update() {
    this.updateClippingPlane();
  }

  destroy() {
    this.clippingParametersBuffer.destroy();
  }
}
