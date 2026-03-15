import {
  type BindableTexture,
  EagerTextureResource,
  type TextureInitDescriptor,
} from "./webGpuTexture";

export class Framebuffer implements BindableTexture {
  private width: number;
  private height: number;
  private readonly colorFormat: GPUTextureFormat;
  private readonly depthFormat: GPUTextureFormat | undefined;
  private readonly colorTexture: EagerTextureResource;
  private depthTexture: EagerTextureResource | undefined;

  constructor(
    device: GPUDevice,
    width: number,
    height: number,
    colorFormat: GPUTextureFormat,
    depthFormat?: GPUTextureFormat
  ) {
    this.width = width;
    this.height = height;
    this.colorFormat = colorFormat;
    this.depthFormat = depthFormat;

    const sampler = device.createSampler({
      label: "Framebuffer Sampler",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });

    this.colorTexture = new EagerTextureResource(
      device,
      Framebuffer.getCreateTextureDescriptor(colorFormat, width, height),
      sampler
    );
    this.depthTexture = depthFormat
      ? new EagerTextureResource(
          device,
          Framebuffer.getDepthTextureDescriptor(depthFormat, width, height)
        )
      : undefined;
  }

  private static getCreateTextureDescriptor(
    format: GPUTextureFormat,
    width: number,
    height: number
  ): TextureInitDescriptor {
    return {
      label: `Framebuffer Color Attachment`,
      dimension: "2d",
      size: { width, height },
      format,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    };
  }

  private static getDepthTextureDescriptor(
    format: GPUTextureFormat,
    width: number,
    height: number
  ): TextureInitDescriptor {
    return {
      label: "Framebuffer Depth Attachment",
      dimension: "2d",
      size: { width, height },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    };
  }

  private allocate() {
    this.colorTexture.createTexture(
      Framebuffer.getCreateTextureDescriptor(
        this.colorFormat,
        this.width,
        this.height
      )
    );

    if (this.depthFormat && this.depthTexture) {
      this.depthTexture.createTexture(
        Framebuffer.getDepthTextureDescriptor(
          this.depthFormat,
          this.width,
          this.height
        )
      );
    }
  }

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.allocate();
  }

  getView(): GPUTextureView {
    return this.colorTexture.getView();
  }

  getTexture(): GPUTexture {
    return this.colorTexture.getTexture();
  }

  getSampler(): GPUSampler | undefined {
    return this.colorTexture.getSampler();
  }

  getColorView(): GPUTextureView {
    return this.getView();
  }

  getColorTexture(): GPUTexture {
    return this.getTexture();
  }

  getDepthView(): GPUTextureView | undefined {
    return this.depthTexture?.getView();
  }

  getDepthTexture(): GPUTexture | undefined {
    return this.depthTexture?.getTexture();
  }

  getRenderPassDescriptor(
    clearColor: GPUColor = { r: 0, g: 0, b: 0, a: 1 }
  ): GPURenderPassDescriptor {
    const colorView = this.getColorView();

    const descriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: colorView,
          clearValue: clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    const depthView = this.getDepthView();
    if (this.depthFormat && depthView) {
      descriptor.depthStencilAttachment = {
        view: depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      };
    }

    return descriptor;
  }

  destroy() {
    this.colorTexture.destroy();
    this.depthTexture?.destroy();
    this.depthTexture = undefined;
  }
}
