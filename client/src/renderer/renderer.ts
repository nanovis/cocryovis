export interface WebGPURenderer {
  init: (canvas: HTMLCanvasElement) => Promise<void>;
  setVertexBuffer: (data: Float32Array) => void;
  destroy: () => void;
}

export function createWebGPURenderer(): WebGPURenderer {
  let device: GPUDevice | null = null;
  let context: GPUCanvasContext | null = null;
  let pipeline: GPURenderPipeline | null = null;
  let vertexBuffer: GPUBuffer | null = null;
  let animationFrame: number | null = null;

  async function init(canvas: HTMLCanvasElement) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No GPU adapter found");
    }

    device = await adapter.requestDevice();

    context = canvas.getContext("webgpu");

    if (!context) {
      throw new Error("WebGPU not supported");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });

    const shader = device.createShaderModule({
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

    pipeline = device.createRenderPipeline({
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
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    render();
  }

  function render() {
    if (!device || !context || !pipeline) return;

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();

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

    pass.setPipeline(pipeline);

    if (vertexBuffer) {
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(3);
    }

    pass.end();
    device.queue.submit([encoder.finish()]);

    animationFrame = requestAnimationFrame(render);
  }

  function setVertexBuffer(data: Float32Array) {
    if (!device) return;

    vertexBuffer?.destroy();

    vertexBuffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(vertexBuffer.getMappedRange()).set(data);
    vertexBuffer.unmap();
  }

  function destroy() {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    vertexBuffer?.destroy();
    vertexBuffer = null;

    device = null;
    context = null;
    pipeline = null;
  }

  return {
    init,
    setVertexBuffer,
    destroy,
  };
}
