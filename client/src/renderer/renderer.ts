export interface DeviceInfo {
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
}

export interface OutputInfo {
  outputFormat: GPUTextureFormat;
  outputView: GPUTextureView;
  aspectRatio: number;
}

export async function initializeDevice(
  canvas: HTMLCanvasElement,
  {
    adapterOptions,
    deviceOptions,
  }: {
    adapterOptions?: GPURequestAdapterOptions;
    deviceOptions?: GPUDeviceDescriptor;
  } = {}
): Promise<DeviceInfo> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported");
  }

  const adapter = await navigator.gpu.requestAdapter(adapterOptions);
  if (!adapter) {
    throw new Error("No GPU adapter found");
  }

  const device = await adapter.requestDevice(deviceOptions);

  const context = canvas.getContext("webgpu");

  if (!context) {
    throw new Error("WebGPU not supported");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  return { adapter, device, context };
}

export class VolumeRenderer {
  device: GPUDevice;
  context: GPUCanvasContext | undefined;
  output: OutputInfo | undefined;

  aspectRatio: number;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline | null = null;
  vertexBuffer: GPUBuffer | null = null;
  animationFrame: number | null = null;

  constructor(
    device: GPUDevice,
    {
      output,
      context,
    }: {
      output?: OutputInfo;
      context?: GPUCanvasContext;
    } = {}
  ) {
    this.device = device;
    this.context = context;
    this.output = output;

    if (output) {
      this.aspectRatio = output.aspectRatio;
      this.format = output.outputFormat;
    } else if (context) {
      this.aspectRatio = context.canvas.width / context.canvas.height;
      this.format = navigator.gpu.getPreferredCanvasFormat();
    } else {
      throw new Error("Either context or output information must be provided");
    }

    const shader = this.device.createShaderModule({
      code: `
        struct VSOut {
          @builtin(position) pos: vec4<f32>,
        };

        @vertex
        fn vs_main(@location(0) position: vec2<f32>) -> VSOut {
          var out: VSOut;
          out.pos = vec4<f32>(position, 0.0, 1.0);
          return out;
        }

        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
          return vec4<f32>(0.3, 0.7, 1.0, 1.0);
        }
      `,
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 8,
            attributes: [
              {
                shaderLocation: 0,
                format: "float32x2",
                offset: 0,
              },
            ],
          },
        ],
      },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.render();
  }

  render() {
    if (!this.pipeline) return;

    const encoder = this.device.createCommandEncoder();
    const view =
      this.output?.outputView ?? this.context?.getCurrentTexture().createView();

    if (!view) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(this.pipeline);

    if (this.vertexBuffer) {
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.draw(3);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    this.animationFrame = requestAnimationFrame(this.render.bind(this));
  }

  setVertexBuffer(data: Float32Array) {
    this.vertexBuffer?.destroy();

    this.vertexBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(data);
    this.vertexBuffer.unmap();
  }

  resize(width: number, height: number) {
    this.aspectRatio = width / height;
  }

  destroy() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.vertexBuffer?.destroy();
    this.vertexBuffer = null;
    this.pipeline = null;
  }
}
