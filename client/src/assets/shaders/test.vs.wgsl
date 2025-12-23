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
  @builtin(position) position : vec4<f32>,
}

const vertices = array(
    vec4f(-1.0, -1.0,  0.0,  0.0),
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

  return output;
}