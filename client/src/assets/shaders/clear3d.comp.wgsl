struct Param
{
	vertex : vec4<f32>,
	kernelSize : vec4<i32>,
	clearMask : vec4<f32>,

	addAnnotation : u32,
  annotationVolume : i32,
}

@group(0) @binding(0) var<uniform> param : Param;
@group(0) @binding(1) var output : texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(2) var input : texture_3d<f32>;

@compute @workgroup_size(8, 8, 8)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>)
{
	var textureSize = textureDimensions(output);

	if (global_id.x >= textureSize.x || global_id.y >= textureSize.y || global_id.z >= textureSize.z) {
		return;
	}
	var clearColor = vec4<f32>(0.0, 0.0, 0.0, 0.0);

	var currentColor = textureLoad(input, vec3<i32>(global_id), 0).rgba;
	var newValue = mix(currentColor, clearColor, param.clearMask);

	textureStore(output, vec3<i32>(global_id), newValue);
}
