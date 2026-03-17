import Color from "color";
import { EagerTextureResource } from "@/renderer/core/webGpuTexture";
import { clamp } from "../utilities/math";
import { toRgba8 } from "../utilities/color";

interface TransferFunction {
  breakpoints: Breakpoint[];
}

interface Breakpoint {
  position: number;
  color: string;
}

const DEFAULT_RESOLUTION = 256;
const DEFAULT_CHANNELS = 4;

export class TransferFunctionLut extends EagerTextureResource {
  readonly resolution: number;
  readonly channels: number;
  private readonly _transferFunctions: TransferFunction[] = [];

  constructor(
    device: GPUDevice,
    {
      resolution = DEFAULT_RESOLUTION,
      channels = DEFAULT_CHANNELS,
    }: { resolution?: number; channels?: number } = {}
  ) {
    super(device, {
      label: "Transfer Function LUT",
      size: { width: resolution, height: channels, depthOrArrayLayers: 1 },
      dimension: "2d",
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      mipLevelCount: 1,
      sampleCount: 1,
      viewFormats: [],
    });

    this.resolution = resolution;
    this.channels = channels;

    for (let channel = 0; channel < channels; channel += 1) {
      this.setBreakpoints(channel, [
        { position: 0, color: "#00000000" },
        { position: 1, color: "#ffffffff" },
      ]);
    }
  }

  get transferFunctions(): ReadonlyArray<TransferFunction> {
    return this._transferFunctions;
  }

  setBreakpoints(channel: number, breakpoints: Breakpoint[]) {
    if (channel < 0 || channel >= this.channels) {
      return;
    }

    if (breakpoints.length === 0) {
      return;
    }

    const sorted = [...breakpoints]
      .map((point) => ({
        position: clamp(point.position, 0, 1),
        color: point.color,
      }))
      .sort((a, b) => a.position - b.position);

    this._transferFunctions[channel] = { breakpoints: sorted };

    const pixels = new Uint8Array(this.resolution * 4);

    for (let i = 0; i < this.resolution; i += 1) {
      const x = this.resolution === 1 ? 0 : i / (this.resolution - 1);
      const color = this.sampleColorAt(sorted, x);
      const base = i * 4;
      pixels[base] = color[0];
      pixels[base + 1] = color[1];
      pixels[base + 2] = color[2];
      pixels[base + 3] = color[3];
    }

    this.device.queue.writeTexture(
      {
        texture: this.getTexture(),
        origin: { x: 0, y: channel, z: 0 },
      },
      pixels,
      {
        offset: 0,
        bytesPerRow: this.resolution * 4,
        rowsPerImage: 1,
      },
      {
        width: this.resolution,
        height: 1,
        depthOrArrayLayers: 1,
      }
    );
  }

  private sampleColorAt(
    sorted: Breakpoint[],
    x: number
  ): [number, number, number, number] {
    const leftEdge = sorted[0];
    const rightEdge = sorted[sorted.length - 1];

    if (x <= leftEdge.position) {
      return toRgba8(leftEdge.color);
    }

    if (x >= rightEdge.position) {
      return toRgba8(rightEdge.color);
    }

    for (let index = 0; index < sorted.length - 1; index += 1) {
      const left = sorted[index];
      const right = sorted[index + 1];
      if (x < left.position || x > right.position) {
        continue;
      }

      const span = right.position - left.position;
      const t = span <= 0 ? 0 : (x - left.position) / span;

      const mixed = Color(left.color).mix(Color(right.color), clamp(t, 0, 1));
      return toRgba8(mixed.hexa());
    }

    return toRgba8(rightEdge.color);
  }
}
