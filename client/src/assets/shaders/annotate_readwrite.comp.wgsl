requires readonly_and_readwrite_storage_textures;

struct Param {
	vertex: vec4<f32>,
	kernelSize: vec4<i32>,
	clearMask: vec4<f32>,

	addAnnotation: u32,
	annotationVolume: i32,
}

@group(0) @binding(0)
var<uniform> param: Param;

@group(0) @binding(1)
var volume: texture_storage_3d<rgba8unorm, read_write>;

fn apply_brush(pos: vec3<f32>, delta: vec3<i32>) {
	let kernel = param.kernelSize.xyz;

	let strength = length(vec3<f32>(delta) / vec3<f32>(kernel));

	if (strength > 1.0) {
		return;
	}

	let volumeSize = textureDimensions(volume);

	let tex_coord = vec3<i32>(i32(pos.x * f32(volumeSize.x)), i32(pos.y * f32(volumeSize.y)), i32(pos.z * f32(volumeSize.z)));

	let tex_coord_kernel = tex_coord + delta;
	var result = textureLoad(volume, tex_coord_kernel).rgba;

	var density = 0.5 - cos((1.0 - strength) * 3.141592) * 0.5;

	if (!bool(param.addAnnotation)) {
		density = - density;
	}

	result[param.annotationVolume] = clamp(result[param.annotationVolume] + density, 0.0, 1.0);
	textureStore(volume, tex_coord_kernel, result);
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let kernel = param.kernelSize.xyz;

	// Out-of-bounds check
	if (global_id.x >= u32(kernel.x * 2 + 1) || global_id.y >= u32(kernel.y * 2 + 1) || global_id.z >= u32(kernel.z * 2 + 1)) {
		return;
	}

	let delta = vec3<i32>(kernel.x - i32(global_id.x), kernel.y - i32(global_id.y), kernel.z - i32(global_id.z));

	apply_brush(vec3<f32>(param.vertex.x, param.vertex.y, param.vertex.z), delta);
}