export async function readRChannelFromRGBA3DTexture(
  device: GPUDevice,
  texture: GPUTexture
) {
  const width = texture.width;
  const height = texture.height;
  const depth = texture.depthOrArrayLayers;

  const bytesPerPixel = 4; // RGBA8
  const unpaddedBytesPerRow = width * bytesPerPixel;
  const bytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256;
  const bytesPerImage = bytesPerRow * height;
  const bufferSize = bytesPerImage * depth;

  // Readback buffer
  const readBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Copy texture -> buffer
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture },
    {
      buffer: readBuffer,
      bytesPerRow,
      rowsPerImage: height,
    },
    { width, height, depthOrArrayLayers: depth }
  );
  device.queue.submit([encoder.finish()]);

  // Map and extract R channel
  await readBuffer.mapAsync(GPUMapMode.READ);

  const src = new Uint8Array(readBuffer.getMappedRange());
  const rChannel = new Uint8Array(width * height * depth);

  let dst = 0;

  for (let z = 0; z < depth; z++) {
    const sliceOffset = z * bytesPerImage;

    for (let y = 0; y < height; y++) {
      let row = sliceOffset + y * bytesPerRow;

      for (let x = 0; x < width; x++) {
        rChannel[dst++] = src[row]; // R
        row += 4; // skip G,B,A
      }
    }
  }

  readBuffer.unmap();
  readBuffer.destroy();

  return rChannel;
}
