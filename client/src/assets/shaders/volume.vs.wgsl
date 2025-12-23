struct Camera {
  view : mat4x4<f32>,
  viewInv : mat4x4<f32>,
  proj : mat4x4<f32>,
  mvpInv: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera : Camera;

struct VertexInput {
    @builtin(vertex_index) vertexIndex: u32
}

struct VertexOutput {
	@location(0) eye : vec3<f32>,
	@location(1) direction : vec3<f32>,
  @location(2) lightPos : vec3<f32>,
  @location(3) tex_coords : vec2<f32>,
  @builtin(position) position : vec4<f32>,
}

const vertices = array(
    vec4f(-1.0,  0.0,  0.0,  0.0),
    vec4f( 1.0, -1.0,  0.0,  1.0),
    vec4f(-1.0,  1.0,  1.0,  0.0),

    vec4f(-1.0,  1.0,  1.0,  0.0),
    vec4f( 1.0, -1.0,  0.0,  1.0),
    vec4f( 1.0,  1.0,  1.0,  1.0),
);

@vertex fn main(input: VertexInput)
-> VertexOutput
{
  var output : VertexOutput;

  output.position = vec4<f32>(vertices[input.vertexIndex].xy, 0.0, 1.0);
  output.tex_coords = vec2<f32>(vertices[input.vertexIndex].zw);

  let nearPosition = vec4<f32>(output.position.xy, 0.0, 1.0);
  let farPosition = vec4<f32>(output.position.xy, 1.0, 1.0);
  let worldNear = camera.mvpInv * nearPosition;
  let worldFar = camera.mvpInv * farPosition;
  output.eye = worldNear.xyz / worldNear.w;
  let rayTo = worldFar.xyz / worldFar.w;
  output.direction = normalize(rayTo - output.eye);
  output.lightPos = (camera.viewInv * vec4<f32>(0.0, 1.0, 1.0, 1.0)).xyz;

  return output;
}