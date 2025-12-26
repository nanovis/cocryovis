import type { Camera } from "../renderer/camera.ts";
import { clamp } from "./Helpers.ts";

export class OrbitCameraController {
  minDistance = 1;
  maxDistance = 50;
  minPolarAngleRadians = 0.01;
  maxPolarAngleRadians = Math.PI - 0.01;
  rotateSpeed = 0.005;
  zoomSpeed = 0.002;

  private azimuthalAngleRadians = 0;
  private polarAngleRadians = Math.PI / 2;

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private camera: Camera,
    private domElement: HTMLElement,
    private radius: number
  ) {
    this.addEventListeners();
    this.updateCamera();
  }

  setRadius(radius: number) {
    this.radius = radius;
  }

  private addEventListeners() {
    this.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    this.domElement.addEventListener("wheel", this.onWheel, { passive: false });
  }

  dispose() {
    this.domElement.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.domElement.removeEventListener("wheel", this.onWheel);
  }

  private onMouseDown = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;

    this.azimuthalAngleRadians -= dx * this.rotateSpeed;
    this.polarAngleRadians -= dy * this.rotateSpeed;

    this.polarAngleRadians = clamp(
      this.polarAngleRadians,
      this.minPolarAngleRadians,
      this.maxPolarAngleRadians
    );

    this.lastX = e.clientX;
    this.lastY = e.clientY;

    this.updateCamera();
  };

  private onMouseUp = () => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (e.shiftKey) return;

    e.preventDefault();

    this.radius += e.deltaY * this.zoomSpeed;
    this.radius = clamp(this.radius, this.minDistance, this.maxDistance);

    this.updateCamera();
  };

  private updateCamera() {
    const sinPhi = Math.sin(this.polarAngleRadians);

    const x =
      this.camera.viewCenter[0] +
      this.radius * sinPhi * Math.sin(this.azimuthalAngleRadians);
    const y =
      this.camera.viewCenter[1] +
      this.radius * Math.cos(this.polarAngleRadians);
    const z =
      this.camera.viewCenter[2] +
      this.radius * sinPhi * Math.cos(this.azimuthalAngleRadians);

    this.camera.setParameters({
      position: [x, y, z],
    });
  }
}
