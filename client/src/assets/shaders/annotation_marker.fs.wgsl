struct AnnotationMarkerParams {
  center: vec4<f32>,
  kernelSize: vec4<f32>,
  ratio: vec4<f32>,
  color: vec4<f32>
}

struct FragmentInput {
  @location(0) worldPos: vec3<f32>
}

@group(0) @binding(2)
var<uniform> annotationMarkerParams: AnnotationMarkerParams;

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  var worldPos = input.worldPos;
  // Discard fragments that fall outside of the visible clipping plane
  if (any(worldPos < - annotationMarkerParams.ratio.xyz) || any(worldPos > annotationMarkerParams.ratio.xyz)) {
    discard;
  }

  let delta = worldPos - annotationMarkerParams.center.xyz;
  let strength = length(delta / annotationMarkerParams.kernelSize.xyz);
  if (strength > 1.0) {
    discard;
  }
  let density = 0.5 - cos((1.0 - strength) * 3.141592) * 0.5;
  return vec4(annotationMarkerParams.color.xyz, density * 0.5);
}