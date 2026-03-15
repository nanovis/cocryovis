@group(0) @binding(0) var framebufferSampler: sampler;
@group(0) @binding(1) var framebufferTexture: texture_2d<f32>;

@fragment
fn main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let dims = vec2f(textureDimensions(framebufferTexture, 0));
  let uv = position.xy / dims;
  return textureSample(framebufferTexture, framebufferSampler, uv);
}
