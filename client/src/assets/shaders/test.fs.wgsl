struct CubeOutput
{
	t : f32,
	fr : f32,
}

struct Plane
{
	position : vec3<f32>,
	normal : vec3<f32>,
}

struct Camera {
  view : mat4x4<f32>,
  viewInv : mat4x4<f32>,
  proj : mat4x4<f32>,
  mvpInv: mat4x4<f32>,
}

struct Ray
{
	origin : vec3<f32>,
	direction : vec3<f32>,
}

struct Intersection
{
	intersects : bool,
	position : vec3<f32>,
}

struct VolumeRatios
{
	ratio : array<vec4<f32>>,
}

struct TransferFunctionColor
{
	color : array<vec4<f32>>,
}

struct TransferFunctionRamp
{
	ramp : array<f32>,
}

struct ChannelData
{
  color : vec4<f32>,
  ratio: vec4<f32>,
  rampStart: f32,
  rampEnd: f32,
}

struct Param
{
	enableEarlyRayTermination : i32,
	enableJittering : i32,
	enableAmbientOcclusion : i32,
	enableSoftShadows : i32,

	interaction : f32,
	sampleRate : f32,
	aoRadius : f32,
	aoStrength : f32,

	aoNumSamples : i32,
	shadowQuality : f32,
	shadowStrength : f32,
	voxelSize : f32,

	enableVolumeA : i32,
	enableVolumeB : i32,
	enableVolumeC : i32,
	enableVolumeD : i32,

	clippingMask : vec4<f32>,
	viewVector : vec4<f32>,
	clippingPlaneOrigin : vec4<f32>,
	clippingPlaneNormal : vec4<f32>,
	clearColor : vec4<f32>,

	enableAnnotations : i32,
	annotationVolume : i32,
	annotationPingPong : i32,
	shadowRadius : f32,

	rawVolumeChannel : i32,
	numChannels : i32,
	empty2 : i32,
	empty3 : i32,
}

struct Annotations
{
	annotation : array<vec4<f32>>,
}

@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(2) var s : sampler;
@group(0) @binding(3) var volume0 : texture_3d<f32>;
//@group(0) @binding(5) var volume2 : texture_3d<f32>;
//@group(0) @binding(6) var volume3 : texture_3d<f32>;
@group(0) @binding(8) var<uniform> param : Param;
@group(0) @binding(9) var<storage, read> channelData: array<ChannelData>;
//@group(0) @binding(9) var<storage, read> transferFunctionColor: TransferFunctionColor;
//@group(0) @binding(10) var<storage, read> transferFunctionRamp1: TransferFunctionRamp;
//@group(0) @binding(11) var<storage, read> transferFunctionRamp2: TransferFunctionRamp;
//@group(0) @binding(12) var<storage, read> volumeRatios: VolumeRatios;
// @group(0) @binding(13) var<storage, read> annotations: Annotations;

struct FragmentOutput {
	@location(0) color : vec4<f32>,
	@builtin(frag_depth) frag_depth : f32,
}

@fragment
fn main(
	@builtin(position) position : vec4<f32>,
)
-> FragmentOutput
{
	var output : FragmentOutput;
	output.frag_depth = 0.0;

	var pos = vec3<f32>(position.xy / 900, 0.8);

	var red = textureSample(volume0, s, pos).r;

	output.color = vec4<f32>(red, red, red, 1.0);

	return output;
}