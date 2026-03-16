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
var output: texture_storage_3d<rgba8unorm, write>;

@group(0) @binding(2)
var input: texture_3d<f32>;

fn apply_brush(pos: vec3<f32>, delta: vec3<i32>) {
	var kernel = vec3<i32>(i32(param.kernelSize.x), i32(param.kernelSize.y), i32(param.kernelSize.z));

	var strength = pow(f32(delta.x * delta.x) / f32(kernel.x) + f32(delta.y * delta.y) / f32(kernel.y) + f32(delta.z * delta.z) / f32(kernel.z), 0.5);

	if (strength > 1.0) {
		return;
	}

	var volumeSize = textureDimensions(input, 0);

	var tex_coord = vec3<i32>(i32(pos.x * f32(volumeSize.x)), i32(pos.y * f32(volumeSize.y)), i32(pos.z * f32(volumeSize.z)));

	var tex_coord_kernel = tex_coord + delta;
	var result = textureLoad(input, tex_coord_kernel, 0).rgba;

	var density = 0.5 - cos((1.0 - strength) * 3.141592) * 0.5;

	if (!bool(param.addAnnotation)) {
		density = - density;
	}

	result[param.annotationVolume] = clamp(result[param.annotationVolume] + density, 0.0, 1.0);
	textureStore(output, tex_coord_kernel, result);
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	var kernel = vec3<i32>(i32(param.kernelSize.x), i32(param.kernelSize.y), i32(param.kernelSize.z));

	// Out-of-bounds check
	if (global_id.x >= u32(kernel.x * 2 + 1) || global_id.y >= u32(kernel.y * 2 + 1) || global_id.z >= u32(kernel.z * 2 + 1)) {
		return;
	}

	var delta = vec3<i32>(kernel.x - i32(global_id.x), kernel.y - i32(global_id.y), kernel.z - i32(global_id.z));

	apply_brush(vec3<f32>(param.vertex.x, param.vertex.y, param.vertex.z), delta);
}