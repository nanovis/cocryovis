struct Param 
{
	vertex : vec4<f32>,
	kernelSize : vec4<i32>,
	clearMask : vec4<i32>,

	addAnnotation : i32,
  annotationVolume : i32,
}

@group(0) @binding(0) var<uniform> param : Param;
@group(0) @binding(1) var output : texture_storage_3d<rgba8unorm, write>;
@group(0) @binding(2) var input : texture_3d<f32>;

fn copy_kernel(pos : vec3<f32>, delta : vec3<i32>)
{
	var kernel = vec3<i32>(i32(param.kernelSize.x), i32(param.kernelSize.y), i32(param.kernelSize.z));

	var volumeSize = textureDimensions(input, 0);

	var tex_coord = vec3<i32>(i32(pos.x * f32(volumeSize.x)),
							i32(pos.y * f32(volumeSize.y)),
							i32(pos.z * f32(volumeSize.z)));
	
	var tex_coord_kernel = tex_coord + delta;
	var result = textureLoad(input, tex_coord_kernel, 0).rgba;

	textureStore(output, tex_coord_kernel, result);	
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) global_id : vec3<u32>) 
{
	var kernel = vec3<i32>(i32(param.kernelSize.x), i32(param.kernelSize.y), i32(param.kernelSize.z));
	
	// Out-of-bounds check
	if (global_id.x >= u32(kernel.x * 2 + 1) || global_id.y >= u32(kernel.y * 2 + 1) || global_id.z >= u32(kernel.z * 2 + 1)) {
		return;
	}
	
	
	var delta = vec3<i32>(kernel.x - i32(global_id.x), kernel.z - i32(global_id.y), kernel.z - i32(global_id.z));

	copy_kernel(vec3<f32>(param.vertex.x, param.vertex.y, param.vertex.z), delta);
}