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
	mvpInv : mat4x4<f32>,
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

var<private> seedGlobal : u32;
var<private> lightRadius : f32;

fn wang_hash(seedIn : u32) -> u32
{
	var seed = seedIn;
    seed = (seed ^ 61u) ^ (seed >> 16u);
    seed = seed * 9u;
    seed = seed ^ (seed >> 4u);
    seed = seed * u32(0x27d4eb2d);
    seed = seed ^ (seed >> 15u);
    return seed;
}

fn rand() -> f32
{
	seedGlobal = wang_hash(seedGlobal);
	var f = f32(seedGlobal) * (1.0 / 4294967296.0);
	return f / cos(f);
}

fn rand11() -> f32
{
	var result = -1.0 + 2.0 * rand();
	return result;
}

fn cube(eye : vec3<f32>, dir : vec3<f32>, size : vec3<f32>) -> CubeOutput
{
	var output : CubeOutput;
	var far : f32;
	var near : f32;
	var t1 : f32;
	var t2 : f32;
	var t3 : f32;
	output.fr = 0.0;
	far = 9999.0;
	near = -9999.0;
	var i : i32 = 0;
	loop
	{
		if (i >= 3) { break; }

		if (dir[i] == 0.0)
		{
			if (eye[i]<-0.0001 || eye[i]>0.0001)
			{
				output.t = -1.0;
				return output;
			}
		}
		else
		{
			t1 = (-size[i] - eye[i]) / dir[i];
			t2 = (size[i] - eye[i]) / dir[i];
			if (t2 > t1)
			{
				t3 = t1;
				t1 = t2;
				t2 = t3;
			}

			if (t2 > near) {
				near=t2;
			}
			if (t1 < far) {
				far=t1;
			}
			if (far < 0.0) { //eye lies behind the cube and looks away
				output.t = -1.0;
				return output;
			}
			if (near > far) { //eye is drunk
				output.t = -1.0;
				return output;
			}
		}
		i = i + 1;
	}
	if (near < 0.0) //eye lies within the cube
	{
		output.fr = far;
		output.t = 0.0;
	}
	else
	{
		output.fr = far;
		output.t = near;
	}
	return output;
}

var<private> clipped : bool;

fn clip(sample_var : vec4<f32>, pos : vec3<f32> ) -> vec4<f32>
{
	var result = sample_var;
	var d = dot(param.clippingPlaneOrigin.xyz, param.clippingPlaneNormal.xyz);
	var r = dot(pos, param.clippingPlaneNormal.xyz);

	if(d > r)
	{
		//clipped = true;
		//result = result * param.clippingMask;
		return vec4<f32>(0.0, 0.0, 0.0, 0.0);
	}

	return sample_var;
}

//fn dataReadAnnotation(pos : vec3<f32>) -> vec4<f32>
//{
//	var result : vec4<f32>;
//	var volumeRatio = volumeRatios.ratio[0].xyz;
//	var posOrig = (pos - 0.5) * 2.0 * volumeRatio;
//
//	if(bool(param.annotationPingPong))
//	{
//		result = textureSampleLevel(volume2, s, pos, 0.0);
//	}
//	else {
//		result = textureSampleLevel(volume3, s, pos, 0.0);
//	}
//	result = clip(result, posOrig);
//
//	return result;
//}

fn dataRead(pos : vec3<f32>) -> vec4<f32>
{
	var mapped : vec4<f32>;

	var volumeRatio = channelData[0].ratio.xyz;
	var posOrig = (pos - 0.5) * 2.0 * volumeRatio;

	var sample4 = textureSampleLevel(volume0, s, pos, 0.0);

	var low0 = channelData[0].rampStart;
	var high0 = channelData[0].rampEnd;
	mapped.x = clamp((sample4.x - low0) / (high0 - low0), 0.0, 1.0);

	mapped.x = mapped.x * f32(param.enableVolumeA);

	var low1 = channelData[1].rampStart;
	var high1 = channelData[1].rampEnd;
	mapped.y = clamp((sample4.y - low1) / (high1 - low1), 0.0, 1.0);
	mapped.y = mapped.y * f32(param.enableVolumeB);

	var low2 = channelData[2].rampStart;
	var high2 = channelData[2].rampEnd;
	mapped.z = clamp((sample4.z - low2) / (high2 - low2), 0.0, 1.0);
	mapped.z = mapped.z * f32(param.enableVolumeC);

	var low3 = channelData[3].rampStart;
	var high3 = channelData[3].rampEnd;
	mapped.w = clamp((sample4.w - low3) / (high3 - low3), 0.0, 1.0);

	var clipEnabled = param.clippingMask.x != 1.0 ||
					  param.clippingMask.y != 1.0 ||
					  param.clippingMask.z != 1.0;

	if (clipEnabled && !clipped)
	{
		mapped = clip(mapped, posOrig);
	}


	return mapped;
}


fn calcTBNMatrix(direction : vec3<f32>) -> mat3x3<f32>
{
	var tangent : vec3<f32>;
	var binormal : vec3<f32>;

	var c1 = cross(direction, vec3<f32>(0.0, 0.0, 1.0));
	var c2 = cross(direction, vec3<f32>(0.0, 1.0, 0.0));

	if (length(c1) > length(c2))
	{
		tangent = c1;
	}
	else
	{
		tangent = c2;
	}
	tangent = normalize(tangent);

	binormal = cross(direction, tangent);
	binormal = normalize(binormal);


	return mat3x3<f32>(tangent, binormal, direction);
}

fn calcTBNMatrix2(direction : vec3<f32>) -> mat3x3<f32>
{
	var up = normalize(vec3<f32>(0.01, 0.99, 0.9));
	if(dot(direction, up) < 0.1) {
		up = normalize(vec3<f32>(0.01, 0.2, 0.9));
	}
	var tangent = normalize(cross(up, direction));
	var bitangent = normalize(cross(direction, tangent));

	return mat3x3<f32>(tangent, bitangent, direction);
}

fn color_transfer(which : i32) -> vec3<f32>
{
	return channelData[which].color.xyz;
}

fn intersect_plane(ray: Ray, p : Plane) -> Intersection
{
	var d = -dot(p.position, p.normal);
	var v = dot(ray.direction, p.normal);
	var t = -(dot(ray.origin, p.normal) + d) / v;

	var intersection : Intersection;
	intersection.intersects = false;

	if(t > 0.0)
	{
		intersection.intersects = true;
		intersection.position = ray.origin * t * ray.direction;
	}

	return intersection;
}

struct FragmentOutput {
	@location(0) color : vec4<f32>,
	@builtin(frag_depth) frag_depth : f32,
}

@fragment
fn main(
	@location(0) eye : vec3<f32>,
	@location(1) direction : vec3<f32>,
	@location(2) lightPos : vec3<f32>,
	@location(3) tex_coords : vec2<f32>,
	@builtin(position) position : vec4<f32>,
)
-> FragmentOutput
{

	var output : FragmentOutput;
	output.frag_depth = 0.0;
	output.color = vec4<f32>(1.0, 0.0, 0.0, 1.0);

	//var interaction = (param.interaction == 1.0);
	//if(interaction)
	//{
	//	if (i32(position.x) % 2 == 0 || i32(position.y) % 2 == 0)
	//	{
	//		//discard;
	//	}
	//}

	clipped = false;

	var rawVolumeChannel = param.rawVolumeChannel;
	var useRawVolume = rawVolumeChannel >= 0;
	var numChannels = param.numChannels;



	// volumeRatio = voxelSize * (dataSize / maxDataSize)
	var volumeRatio = channelData[0].ratio.xyz;
	//size = vec3<f32>(1.5, 1.0, 1.0);

	// intialize random seed
	//seedGlobal = u32(tex_coords.x * 21032.0 * tex_coords.y * 43242.0);
	seedGlobal = u32(tex_coords.x * tex_coords.y * 1000000.0);


	//get intersection with the bounding cube (in form of distance on the ray dir * t + eye)
	var outputCube = cube(eye, direction, volumeRatio);


	var bg = vec4<f32>(0.2, 0.2, 0.2, 1.0);
	//var bg = param.clearColor;

	if(outputCube.t < 0.0 )
	{
		output.color = bg;
		return output;
		//discard;
	}
	else
	{
		//return vec4<f32>(0.0, 1.0, 0.0, 1.0);
	}

	var stepSize = 0.01;
	stepSize = stepSize / param.sampleRate;

	// ray offset jittering
	if (bool(param.enableJittering))
	{
		outputCube.t = outputCube.t + rand() * stepSize * 1.0;
	}

	var iterations = i32((outputCube.fr - outputCube.t) / stepSize);

	var src = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	var dst = vec4<f32>(0.0, 0.0, 0.0, 0.0);

	// D3D backend will unroll loops and cause following error when gradient instructions are used
	// error X3511: unable to unroll loop, loop does not appear to terminate in a timely manne
	// It's a known problem with the FXC compiler used by Chrome
	// https://bugs.chromium.org/p/tint/issues/detail?id=1112
	// Fix: do not use gradient instruction, such as all texture sampling methods which determine the used mip-level by themselves
	// instead define mip map level through "textureSampleLevel()"

	// raymarching
	var accumA = 0.0;
	var accumC = vec3<f32>(0.0, 0.0, 0.0);

	var quit = false;
	var clipColor = vec4<f32>(0.0, 0.0, 0.0, 0.0);
	var firstHit = true;

	var enableAO = bool(param.enableAmbientOcclusion);
	var enableSoftShadows = bool(param.enableSoftShadows);
	var enableEarlyRayTermination = bool(param.enableEarlyRayTermination);
	var enableAnnotations = bool(param.enableAnnotations);

	for (var i: i32 = 0; i < iterations; i += 1)
	{
    	//calculate intersection along the ray
		var tmp = f32(i) * stepSize + outputCube.t;
		var isec0 = tmp * direction + eye;
		//var isec0Shifted = isec0;

		// account for the data padding and shift the volume in the center
		//isec0Shifted.x = isec0Shifted.x - (param.paddingRatioX / 2.0);
		//transform it to match the bounding box centered on [0, 0, 0]
		var isec1 = (isec0 / volumeRatio) * 0.5 + 0.5;

		if (isec1.x < 0.0 || isec1.x > 1.0 ||
			isec1.y < 0.0 || isec1.y > 1.0 ||
			isec1.z < 0.0 || isec1.z > 1.0)
		{
			continue;
		}

//		output.color = vec4<f32>(isec1.xyz, 1.0);
//
//		return output;

		var masks = vec4<f32>(0.0);
		// 0,1,2 mask 3 is raw data
		masks = dataRead(isec1);


		if (masks.x < 0.01 && masks.y < 0.01 && masks.z < 0.01) {
			masks = vec4<f32>(0.0, 0.0, 0.0, 0.0);
		}

		// ======================== SAMPLE ANNOTATION VOLUME ========================
		var annotationColor = vec4<f32>(0, 0, 0, 0);
//		if(enableAnnotations)
//		{
//			var annotationVec = dataReadAnnotation(isec1);
//			for (var i: i32 = 0; i < 4; i += 1) {
//				var alpha: f32 = annotations.annotation[i].a * annotationVec[i];
//				if (alpha > annotationColor.a) {
//					annotationColor = vec4<f32>(annotations.annotation[i].rgb, alpha);
//				}
//			}
//		}

		// voxels with low influence are skipped
		var influence = 0.0;

		for (var i: i32 = 0; i < numChannels; i = i + 1)
		{
			if(i != rawVolumeChannel) {
				influence += masks[i];
			}
		}

		if (influence <= 0.2 || (useRawVolume && masks[rawVolumeChannel] <= 0.1)) {
			continue;
		}

		// store depth of first hit
		if(firstHit)
		{
			var projPos = camera.proj * camera.view * vec4<f32>(isec0.xyz, 1.0);
			output.frag_depth = projPos.z / projPos.w;
			firstHit = false;
		}

		// ============= OBJECTS SPACE AMBIENT OCCLUSION =============
		var ao = 0.0;
		if (enableAO)
		{
			var radius = param.aoRadius * 0.015 * param.voxelSize;

			for (var j: i32 = 0; j < param.aoNumSamples; j = j + 1)
			{
				var randomOffset = vec3<f32>(rand11(), rand11(), rand11());
				randomOffset = normalize(randomOffset);
				randomOffset = randomOffset / volumeRatio;
				//var tbn = calcTBNMatrix(normalize(lightPos - isec1));
				//randomOffset = tbn * randomOffset;
				var offsetLength = 0.2 + rand() * 0.5;
				randomOffset = randomOffset * radius * offsetLength;

				var sample_pos = isec1 + randomOffset;
				var sample_var = vec3<f32>(0.0);
				// sample only within bounds of the texture
				if(sample_pos.x > 0.0 && sample_pos.x < 1.0 &&
				   sample_pos.y > 0.0 && sample_pos.y < 1.0 &&
				   sample_pos.z > 0.0 && sample_pos.z < 1.0)
				{
					sample_var = dataRead(sample_pos).xyz;
				}
				var value = (sample_var.x + sample_var.y + sample_var.z);
				value = clamp(value, 0.0, 1.0);
				var occlusion = 1.0 - value;
				//var occlusion = 1.0 - clamp(voxel.x + voxel.y + voxel.z, 0.0, 1.0);

				ao = ao + occlusion;
			}
			ao = ao / f32(param.aoNumSamples);
			ao = ao * param.aoStrength;
		}

		// ======================== SOFT SHADOWS ========================
		var shadow = 0.0;
		if (enableSoftShadows)
		{
			var sTotal : f32;

			sTotal = 0.0;

			var quality : i32;
			quality = 1;

			//var samplingRadiusShadow = 0.2;
			var stepShadow = 0.05 / param.shadowQuality;
			var shadowStrength = param.shadowStrength * 5.0;
			var shadowSampleCount = 0;

			for (var q: i32 = 0; q < quality; q = q + 1)
			{
				for (var t: f32 = 0.05; t < 1.0; t = t + stepShadow)
				{
					var halfV = normalize(lightPos - isec1);

					var sample_pos = isec1 + halfV * t * param.shadowRadius;

					var sample_var = vec3<f32>(0.0);
					// sample only within bounds of the texture
					if(sample_pos.x > 0.0 && sample_pos.x < 1.0 &&
					   sample_pos.y > 0.0 && sample_pos.y < 1.0 &&
				       sample_pos.z > 0.0 && sample_pos.z < 1.0)
					{
						sample_var = dataRead(sample_pos).xyz;
					}

					var value = 1.0 - (sample_var.x + sample_var.y + sample_var.z);
					var low = channelData[4].rampStart;
					var high = channelData[4].rampEnd;
					var occlusion = 1.0 - clamp((value - low) / (high - low), 0.0, 1.0);
					//occlusion = 1.0 - value;
					//occlusion = 1.0 - dataRead(sp, 1).x;

					shadow = shadow + (occlusion); // pow((0.25 - t) * 2.0, 1.0)

					//sample count for the shadow normalization
					shadowSampleCount = shadowSampleCount + 1;
				}

				sTotal = sTotal + shadow;
			}
			shadow = sTotal / f32(shadowSampleCount);
			shadow = shadow * shadowStrength;
			shadow = clamp(shadow, 0.0, 1.0);
		}

		// ============= COLOR AND ALPHA ACCUMULATION =============
		for (var which: i32 = 0; which < numChannels; which += 1)
		{
			if(which == rawVolumeChannel) {
				continue;
			}
			var alpha = masks[which];
			var color = color_transfer(which) * 1.0;

			// alpha normalization based on the stepSize
			alpha = alpha * stepSize / 0.0025;

			// alpha normalization - correct, but slower formula
			//var ds = stepSize * 20.0;
			//alpha = 1.0 - pow(1.0 - alpha, ds);

			// apply original data, only use when raw data is available
			if(useRawVolume) {
				alpha = alpha * masks[rawVolumeChannel];
			}

			//shading
			var originalColor = color;

			color = mix(color, vec3<f32>(0.0, 0.01, 0.02), ao);
			color = mix(color, vec3<f32>(0.0, 0.015, 0.03), shadow);

//			if (annotationColor.a > 0) {
//				var stripe = annotationColor.xyz;
//
//				var stripeStrength = 0.2;
//				if (sin((position.x + position.y) * 100.0) > 0.0)
//				{
//					stripe = mix(stripe, vec3<f32>(0.0, 0.0, 0.0), stripeStrength);
//				}
//				else
//				{
//					stripe = mix(stripe, vec3<f32>(1.0, 1.0, 1.0), stripeStrength);
//				}
//
//				color = mix(color, stripe, annotationColor.a);
//			}

			//front to back alpha compositing
			accumC = accumC + (1.0 - accumA) * color.xyz * alpha;
			accumA = accumA + (1.0 - accumA) * alpha;

			// break from loop on high enough alpha value
			if (enableEarlyRayTermination && accumA >= 0.8)
			{
				accumA = 1.0;
				quit = true;
				break;
			}
		}

		// early ray termination
		if (quit)
		{
			break;
		}
	}

	// make the picture brighter
	accumC = accumC * 1.5;

	// apply background color
	accumC = accumC + (1.0 - accumA) * bg.xyz;
	accumA = accumA + (1.0 - accumA);

	// background
	if(accumA == 0.0) {
		accumA = 1.0;
	}

	var fragColor = vec4<f32>(accumC.x, accumC.y, accumC.z, accumA);

	/*fragColor.x = fragColor.x * 4.0;
	fragColor.y = fragColor.y * 4.0;
	fragColor.z = fragColor.z * 4.0;*/

	//fragColor = sample;
	//fragColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
	//fragColor = fragColor + clipColor;
	//output.frag_depth = 0.5;
	output.color = fragColor;

	return output;
}