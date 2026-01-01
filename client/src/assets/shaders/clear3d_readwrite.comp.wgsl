requires readonly_and_readwrite_storage_textures;

struct Param
{
	vertex : vec4<f32>,
	kernelSize : vec4<i32>,
	clearMask : vec4<f32>,

	addAnnotation : i32,
  annotationVolume : i32,
}

@group(0) @binding(0) var<uniform> param : Param;
@group(0) @binding(1) var volume : texture_storage_3d<rgba8unorm, read_write>;

@compute @workgroup_size(8, 8, 8)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>)
{
	var textureSize = textureDimensions(volume);

	if (global_id.x >= textureSize.x || global_id.y >= textureSize.y || global_id.z >= textureSize.z) {
		return;
	}
	var clearColor = vec4<f32>(0.0, 0.0, 0.0, 0.0);

	var currentColor = textureLoad(volume, vec3<i32>(global_id)).rgba;
	var newValue = mix(currentColor, clearColor, param.clearMask);

	textureStore(volume, vec3<i32>(global_id), newValue);
}
