struct Camera {
  view: mat4x4<f32>,
  viewInv: mat4x4<f32>,
  proj: mat4x4<f32>,
  mvpInv: mat4x4<f32>,
}

struct ClippingPlane {
  origin: vec4<f32>,
  normal: vec4<f32>,
  enabled: i32,
}

struct AnnotationMarkerParams {
  center: vec4<f32>,
  kernelSize: vec4<f32>,
  ratio: vec4<f32>,
  color: vec4<f32>
}

@group(0) @binding(0)
var<uniform> camera: Camera;

@group(0) @binding(1)
var<uniform> clippingPlane: ClippingPlane;

@group(0) @binding(2)
var<uniform> annotationMarkerParams: AnnotationMarkerParams;

struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>
}

const corners = array<vec2<f32>, 4>(
  vec2(-1.0, -1.0),
  vec2( 1.0, -1.0),
  vec2(-1.0,  1.0), 
  vec2( 1.0,  1.0)
);

@vertex
fn main(input: VertexInput) -> VertexOutput {
  let c = corners[input.vertexIndex];

  let normal = normalize(clippingPlane.normal);

  let up = select(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), abs(normal.y) > 0.999);
  let tangent = normalize(cross(up, normal.xyz));
  let bitangent = cross(normal.xyz, tangent.xyz);

  let worldPos = annotationMarkerParams.center.xyz + tangent * c.x * annotationMarkerParams.kernelSize.x + bitangent * c.y * annotationMarkerParams.kernelSize.y;

  var out: VertexOutput;
  out.position = camera.proj * camera.view * vec4(worldPos, 1.0);
  out.worldPos = worldPos;

  return out;
}