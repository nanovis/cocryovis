struct Camera {
  view : mat4x4<f32>,
  viewInv : mat4x4<f32>,
  proj : mat4x4<f32>,
  mvpInv: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera : Camera;

struct VertexOutput {
	@location(0) eye : vec3<f32>,
	@location(1) direction : vec3<f32>,
  @location(2) lightPos : vec3<f32>,
  @location(3) tex_coords : vec2<f32>,
  @builtin(position) position : vec4<f32>,
}

@vertex fn main(
@location(0) vertex : vec3<f32>,
@location(1) txCoord : vec2<f32>)
-> VertexOutput
{
  var output : VertexOutput;

  output.tex_coords = txCoord;

  output.position = vec4<f32>(vertex, 1.0);

  let nearPosition = vec4<f32>(vertex.xy, 0.0, 1.0);
  let farPosition = vec4<f32>(vertex.xy, 1.0, 1.0);
  let worldNear = camera.mvpInv * nearPosition;
  let worldFar = camera.mvpInv * farPosition;
  output.eye = worldNear.xyz / worldNear.w;
  let rayTo = worldFar.xyz / worldFar.w;
  output.direction = normalize(rayTo - output.eye);
  output.lightPos = (camera.viewInv * vec4<f32>(0.0, 1.0, 1.0, 1.0)).xyz;

  return output;
}