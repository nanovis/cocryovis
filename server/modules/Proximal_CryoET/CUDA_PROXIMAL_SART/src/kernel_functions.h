#pragma once

//Cuda libraries
#include "cuda_runtime.h"
#include "device_launch_parameters.h"

#include<math.h>
#include<stdio.h>

//managed variables can be accessed from host and device code
__device__ __managed__ uint3 vdim; //x, y, z sizes of volume
__device__ __managed__ uint3 pdim; //x, y sizes of projection
__device__ __managed__ float source_object_distance; //Distance from source plane to center of the volume
__device__ __managed__ float3 vdelta; //Difference between volume center and voxel with index (0, 0, 0)
__device__ __managed__ float2 pdelta; //Difference between volume center and pixel with index (0, 0)
__device__ __managed__ float sample_rate; //stepsize for volume rendering in forward projection
__device__ __managed__ float cost = 0; //Cosine of current angle
__device__ __managed__ float sint = 0; //sine of current angle
__device__ __managed__ float chill_factor; //Relaxation factor lambda for the backward projection
__device__ __managed__ unsigned int current_projection; //current projection number
__device__ __managed__ float3 dir; //Current ray direction
__device__ __managed__ float3 pip; //Current point in sensor plane for backprojection
__device__ __managed__ unsigned int M; //Number of steps in the ray in FP
__device__ __managed__ float lambda; //regularization term for proxi sart
__device__ __managed__ float ro; //Scalar of augmented Laplacian function for LADMM
__device__ __managed__ float mu; //Part of matrix S to solve data term in LADMM
__device__ __managed__ float sigma; //For ATV thresholding
__device__ __managed__ float gamma_pd = 1.0f; //For PD
__device__ __managed__ float tau; //For PD
__device__ __managed__ float theta; //For PD
__device__ __managed__ unsigned int tile_size = 0; //Size of vertical slice
__device__ __managed__ unsigned int number_extra_rows = 0; //Number of extra rows above and below, has to be divisible by 2
__device__ __managed__ unsigned int number_of_tiles = 1; 
__device__ __managed__ unsigned int current_tile = 0;
__device__ __managed__ bool tiled = true;
__device__ __managed__ unsigned int volume_depth = 300;
__device__ __managed__ int nlm_w; //Size of patch
__device__ __managed__ int nlm_s; //Size of naive search area
__device__ __managed__ float nlm_h; //square of!! filtering parameter
__device__ __managed__ int padding = 0; //Size of the padding on one side (half of total padding)
__device__ __managed__ bool nlm_finish_2d = false; //If true, last iterations are performed with 2DNLM denoiser
__device__ __managed__ bool nlm_finish_3d = false; //If true, last iterations are performed with 3DNLM denoiser
__device__ __managed__ int nlm_last_iters = 3; //Number of iterations with NLM if nlm_finish is true
__device__ __managed__ int nlm_skip = 1; //Number of skips
__device__ __managed__ bool nlm_weight_xz = false; //If true, compute weights in XZ plane instead of XY
__device__ __managed__ bool nlm_xz = false; //If true, use nlm_XZ
__device__ __managed__ bool data_term_end = false; //If true, an iteration of the data term is performed in the end, before saving.
__device__ __managed__ int number_of_bins = 1024; //Number of bins for histogram equalization
__device__ __managed__ float gamma_correct = 1.0f; //For gamma correction
__device__ __managed__ float i_0 = 0; //For linearizing projections / delinearizing volumes
__device__ __managed__ bool ignore_padding = true;
__device__ __managed__ bool nonnegativity = true;
__device__ __managed__ float huber_lambda = 1;

//Kernel lookup table
//20001 values from 0 to 2 in steps of 0.0001
//From a kaiser-bessel kernel with support radius two
//Check matlab file and files x, y
//From Mueller's phd thesis voxel basis section.
__device__ __managed__ float kernel_lookup[20001];

//Returns true if in reconstruction region
//false otherwise
__device__ bool reconstruction_region(int x)
{
	if (!ignore_padding || ((x >= padding) && (x < padding + pdim.x)))
		return true;
	return false;
}

__device__ bool reconstruction_region_nlm(int x)
{
	if ((x >= padding) && (x < padding + pdim.x))
		return true;
	return false;
}

//Device operators and functions
__device__ float3 operator+(const float3& a, const float3& b)
{
	return make_float3(a.x + b.x, a.y + b.y, a.z + b.z);
}

__device__ float3 operator-(const float3& a, const float3& b)
{
	return make_float3(a.x - b.x, a.y - b.y, a.z - b.z);
}

__device__ float length(const float3& a)
{
	return sqrtf(a.x*a.x + a.y*a.y + a.z*a.z);
}

__device__ float sign(float x)
{
	int t = x < 0 ? -1 : 0;
	return x > 0 ? 1 : t;
}

__device__ float3 operator*(const float& a, const float3& b)
{
	return make_float3(a*b.x, a*b.y, a*b.z);
}

__device__ float3 operator*(const float3& b, const float& a)
{
	return a*b;
}

//Rotate clockwise around y axis
//Rotation angle = current dir/angle
//Y is unchanged
__device__ float3 rotate_clockwise(float3& b)
{
	b = make_float3(cost*b.x + sint*b.z, b.y, cost*b.z - sint*b.x);
	return b;
}

//Rotate anticlockwise around y axis
//Rotation angle = -current dir/angle
//y is unchanged
__device__ float3 rotate_anticlockwise(float3& b)
{
	b = make_float3(cost*b.x - sint * b.z, b.y, cost*b.z + sint*b.x);
	return b;
}

__global__ void atv_po_kernel(const float* kx, const float* y, float* z);
__global__ void htv_po_kernel(const float* kx, const float* y, float* z);
__global__ void NLM_2D_kernel(const float* volume, float* denoised);
__global__ void NLM_2D_XZ_kernel(const float* volume, float* denoised);
__global__ void NLM_3D_kernel(const float* volume, float* denoised);

//Bilinear interpolation 2D array with dimensions dim at position pos
__device__ float interpol2D(const float* vol_data, const float2& pos, const uint2& dim)
{
	//Get low left, rear point point
	int2 p11 = make_int2(floorf(pos.x), floorf(pos.y));

	//Are we at the rightmost or topmost column?
	bool xlimit = false;
	bool ylimit = false;

	int2 p21;
	if (p11.x < (dim.x - 1))
		p21 = make_int2(p11.x + 1, p11.y);
	else
	{
		xlimit = true;
		p21 = p11;
	}

	int2 p12;
	if (p11.y < (dim.y - 1))
		p12 = make_int2(p11.x, p11.y + 1);
	else
	{
		ylimit = true;
		p12 = p11;
	}

	int2 p22;
	if (!xlimit)
		p22 = make_int2(p12.x + 1, p12.y);
	else
		p22 = p12;

	//Get the volume data values of the cell points
	float q11 = vol_data[p11.x + p11.y * dim.x];
	float q21 = vol_data[p21.x + p21.y * dim.x];
	float q12 = vol_data[p12.x + p12.y * dim.x];
	float q22 = vol_data[p22.x + p22.y * dim.x];

	//Interpolate
	float ip1, ip2;
	if (!xlimit)
	{
		ip1 = ((p21.x - pos.x) / (p21.x - p11.x)) * q11 + ((pos.x - p11.x) / (p21.x - p11.x)) * q21;
		ip2 = ((p22.x - pos.x) / (p22.x - p12.x)) * q12 + ((pos.x - p12.x) / (p22.x - p12.x)) * q22;
	}
	else
	{
		ip1 = q11;
		ip2 = q22;
	}

	if (!ylimit)
	{
		return ((p12.y - pos.y) / (p12.y - p11.y)) * ip1 + ((pos.y - p11.y) / (p12.y - p11.y)) * ip2;
	}
	else
	{
		return ip1;
	}
}

//interpol(data_pointer, position inside volume, volume dimensions)
//Get scalar value of the volume data at an arbitrary x, y, z position
//By trilinear interpolation of 8 neighboring cells
__device__ float interpol(const float* vol_data, const float3 &pos, const uint3 &dim)
{
	//Get low left rear point 
	int3 p11 = make_int3(floorf(pos.x), floorf(pos.y), floorf(pos.z));

	//Are we at the rightmost or topmost column?
	bool xlimit = false;
	bool ylimit = false;
	bool zlimit = !(p11.z < (dim.z - 1));

	int2 p21;
	if (p11.x < (dim.x - 1))
		p21 = make_int2(p11.x + 1, p11.y);
	else
	{
		xlimit = true;
		p21 = make_int2(p11.x, p11.y);
	}

	int2 p12;
	if (p11.y < (dim.y - 1))
		p12 = make_int2(p11.x, p11.y + 1);
	else
	{
		ylimit = true;
		p12 = make_int2(p11.x, p11.y);
	}

	int2 p22;
	if (!xlimit)
		p22 = make_int2(p12.x + 1, p12.y);
	else
		p22 = p12;

	//Get the volume data values of the cell points
	float q11 = vol_data[p11.x + p11.y*dim.x + p11.z*dim.y*dim.x];
	float q21 = vol_data[p21.x + p21.y*dim.x + p11.z*dim.y*dim.x];
	float q12 = vol_data[p12.x + p12.y*dim.x + p11.z*dim.y*dim.x];
	float q22 = vol_data[p22.x + p22.y*dim.x + p11.z*dim.y*dim.x];	

	//Same, next z value
	float s11, s21, s12, s22;
	if (!zlimit)
	{
		s11 = vol_data[p11.x + p11.y*dim.x + (p11.z + 1)*dim.y*dim.x];
		s21 = vol_data[p21.x + p21.y*dim.x + (p11.z + 1)*dim.y*dim.x];
		s12 = vol_data[p12.x + p12.y*dim.x + (p11.z + 1)*dim.y*dim.x];
		s22 = vol_data[p22.x + p22.y*dim.x + (p11.z + 1)*dim.y*dim.x];
	}
	else
	{
		s11 = q11;
		s21 = q21;
		s12 = q12;
		s22 = q22;
	}

	//Interpolate
	float ip1, ip2, is1, is2;
	if (!xlimit)
	{
		ip1 = ((p21.x - pos.x) / (p21.x - p11.x)) * q11 + ((pos.x - p11.x) / (p21.x - p11.x)) * q21;
		ip2 = ((p22.x - pos.x) / (p22.x - p12.x)) * q12 + ((pos.x - p12.x) / (p22.x - p12.x)) * q22;

		is1 = ((p21.x - pos.x) / (p21.x - p11.x)) * s11 + ((pos.x - p11.x) / (p21.x - p11.x)) * s21;
		is2 = ((p22.x - pos.x) / (p22.x - p12.x)) * s12 + ((pos.x - p12.x) / (p22.x - p12.x)) * s22;
	}
	else
	{
		ip1 = q11;
		ip2 = q22;

		is1 = s11;
		is2 = s22;
	}

	float interpol1;
	float interpol2;
	if (!ylimit)
	{
		interpol1 = ((p12.y - pos.y) / (p12.y - p11.y)) * ip1 + ((pos.y - p11.y) / (p12.y - p11.y)) * ip2;
		interpol2 = ((p12.y - pos.y) / (p12.y - p11.y)) * is1 + ((pos.y - p11.y) / (p12.y - p11.y)) * is2;
	}
	else
	{
		interpol1 = ip1;
		interpol2 = is1;
	}

	if (!zlimit)
	{
		return (((p11.z + 1) - pos.z) / ((p11.z + 1) - p11.z)) * interpol1 + ((pos.z - p11.z) / ((p11.z + 1) - p11.z)) * interpol2;
	}
	else
	{
		return interpol1;
	}
}

//Stores the 4D volume gradient of rec_vol in vol_grad
//For the edges, a value of 0 is assumed outside the volume
__global__ void volume_gradient_kernel(const float* rec_vol, float* vol_grad)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if (reconstruction_region(col) && (row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//If we are in the x limit, assume the values outside the volume to be zero
		//The gradient is the negative of the voxel value. The same applies for y and z
		if (col < (vdim.x - 1))
			vol_grad[voxel_index] = rec_vol[voxel_index + 1] - rec_vol[voxel_index];
		else
			vol_grad[voxel_index] = rec_vol[voxel_index - col]  -rec_vol[voxel_index];
			//vol_grad[voxel_index] = -rec_vol[voxel_index];

		if (row < (vdim.y - 1))
			vol_grad[voxel_index + vdim.z*vdim.y*vdim.x] = rec_vol[voxel_index + vdim.x] - rec_vol[voxel_index];
		else
			vol_grad[voxel_index + vdim.z*vdim.y*vdim.x] = rec_vol[voxel_index - row*vdim.x] - rec_vol[voxel_index];
			//vol_grad[voxel_index + vdim.z*vdim.y*vdim.x] = -rec_vol[voxel_index];

		if (blockIdx.z < (vdim.z - 1))
			vol_grad[voxel_index + 2*vdim.z*vdim.y*vdim.x] = rec_vol[voxel_index + vdim.y*vdim.x] - rec_vol[voxel_index];
		else
			vol_grad[voxel_index + 2*vdim.z*vdim.y*vdim.x] = rec_vol[voxel_index - blockIdx.z*vdim.y*vdim.x] - rec_vol[voxel_index];
			//vol_grad[voxel_index + 2 * vdim.z*vdim.y*vdim.x] = -rec_vol[voxel_index];
	}	
}

//Transpose of the gradient
//Operates on 4D gradient of the volume and generates a 3D object of the same size than the volume
//One thread/voxel
__global__ void volume_divergence_kernel(const float* vol_grad, float* vol_div)
{

	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Negative of the derivatives of the current voxel
		vol_div[voxel_index] = -vol_grad[voxel_index] - vol_grad[voxel_index + vdim.z*vdim.y*vdim.x] - vol_grad[voxel_index + 2 * vdim.z*vdim.y*vdim.x];

		//X derivative of voxel 'to the left' / previous column
		if (col > 0)
			vol_div[voxel_index] += vol_grad[voxel_index - 1];

		//Y derivative of previous row
		if (row > 0)
			vol_div[voxel_index] += vol_grad[(voxel_index - vdim.x) + vdim.z*vdim.y*vdim.x];

		//Z derivative of voxel in previous slice
		if (blockIdx.z > 0)
			vol_div[voxel_index] += vol_grad[(voxel_index - vdim.y*vdim.x) + 2*vdim.z*vdim.y*vdim.x];
	}
}

//One thread/voxel
//x = x - mu*ro*trans(K)*(K*x - z + y)
//Check TRex algorithm 4 for details
__global__ void update_x_ladmm_kernel(float* x, const float* z, const float* y)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Get x, y, z gradients of current voxel
		float3 grad = make_float3(0, 0, 0);
		if (col < (vdim.x - 1))
			grad.x = x[voxel_index + 1] - x[voxel_index];
		else
			grad.x = x[voxel_index - col] - x[voxel_index]; //
			//grad.x = -x[voxel_index];

		if (row < (vdim.y - 1))
			grad.y = x[voxel_index + vdim.x] - x[voxel_index];
		else
			grad.y = x[voxel_index - row*vdim.x] - x[voxel_index]; //
			//grad.y = -x[voxel_index];

		if (blockIdx.z < (vdim.z - 1))
			grad.z = x[voxel_index + vdim.y*vdim.x] - x[voxel_index];
		else
			grad.z = x[voxel_index - blockIdx.z*vdim.y*vdim.x] - x[voxel_index];
			//grad.z = -x[voxel_index];

		//Compute the divergence of (K*x - z + y) at the current voxel
		float div = +z[voxel_index] + z[voxel_index + vdim.z*vdim.y*vdim.x] + z[voxel_index + 2 * vdim.z*vdim.y*vdim.x]
			- y[voxel_index] - y[voxel_index + vdim.z*vdim.y*vdim.x] - y[voxel_index + 2 * vdim.z*vdim.y*vdim.x]
			- grad.x - grad.y - grad.z;

		//If not in X limit, add the Fx of previous voxel. Same for the other axis
		if (col > 0)
			div += x[voxel_index] - x[voxel_index - 1] - z[voxel_index - 1] + y[voxel_index - 1];
		else
			div += x[voxel_index] - x[voxel_index + vdim.x - 1] - z[voxel_index + vdim.x - 1] + y[voxel_index + vdim.x - 1];

		if (row > 0)
			div += x[voxel_index] - x[voxel_index - vdim.x] - z[voxel_index - vdim.x + vdim.z*vdim.y*vdim.x] + y[voxel_index - vdim.x + vdim.z*vdim.y*vdim.x];
		else
			div += x[voxel_index] - x[voxel_index + (vdim.y-1)*vdim.x] - z[voxel_index + (vdim.y - 1)*vdim.x + vdim.z*vdim.y*vdim.x] + y[voxel_index + (vdim.y - 1)*vdim.x + vdim.z*vdim.y*vdim.x];

		if (blockIdx.z > 0)
			div += x[voxel_index] - x[voxel_index - vdim.y*vdim.x] - z[voxel_index - vdim.y*vdim.x + 2 * vdim.z*vdim.y*vdim.x] + y[voxel_index - vdim.y*vdim.x + 2 * vdim.z*vdim.y*vdim.x];
		else
			div += x[voxel_index] - x[voxel_index + vdim.y*vdim.x*(vdim.z-1)] - z[voxel_index + vdim.y*vdim.x*(vdim.z - 1) + 2*vdim.z*vdim.y*vdim.x] + y[voxel_index + vdim.y*vdim.x*(vdim.z - 1) + 2*vdim.z*vdim.y*vdim.x];

		//x = x - mu*ro*trans(K)*(K*x - z + y)
		x[voxel_index] = x[voxel_index] - mu*ro*div;

		//Nonnegativity constraint
		if (nonnegativity && (x[voxel_index] < 0))
			x[voxel_index] = 0;
	}
}

//x = x - mu*ro*trans(K)*(K*x - z + y)
//Ktv is forward derivative
//Knlm is identity
//x = x - mu*ro*(trans(Ktv), I)*((Ktv;I)*x - z + y)
//x = x - mu*ro*(trans(Ktv)*(Ktv*x - Ztv + Ytv) + (x - Znlm + Ynlm))
__global__ void update_x_ladmm_kernel_2(float* x, const float* z, const float* z_nlm, const float* y, const float* y_nlm)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Get x, y, z gradients of current voxel
		//grad = (Ktv*x)
		float3 grad = make_float3(0, 0, 0);
		if (col < (vdim.x - 1))
			grad.x = x[voxel_index + 1] - x[voxel_index];
		else
			grad.x = x[voxel_index - col] - x[voxel_index];

		if (row < (vdim.y - 1))
			grad.y = x[voxel_index + vdim.x] - x[voxel_index];
		else
			grad.y = x[voxel_index - row * vdim.x] - x[voxel_index];

		if (blockIdx.z < (vdim.z - 1))
			grad.z = x[voxel_index + vdim.y*vdim.x] - x[voxel_index];
		else
			grad.z = x[voxel_index - blockIdx.z*vdim.y*vdim.x] - x[voxel_index];

		//Compute the divergence of (Ktv*x - z + y) at the current voxel
		//div = trans(Ktv)*(Ktv*x - Ztv + Ytv)
		float div = +z[voxel_index] + z[voxel_index + vdim.z*vdim.y*vdim.x] + z[voxel_index + 2 * vdim.z*vdim.y*vdim.x]
			- y[voxel_index] - y[voxel_index + vdim.z*vdim.y*vdim.x] - y[voxel_index + 2 * vdim.z*vdim.y*vdim.x]
			- grad.x - grad.y - grad.z;

		//If not in X limit, add the Fx of previous voxel. Same for the other axis
		if (col > 0)
			div += x[voxel_index] - x[voxel_index - 1] - z[voxel_index - 1] + y[voxel_index - 1];
		else
			div += x[voxel_index] - x[voxel_index + vdim.x - 1] - z[voxel_index + vdim.x - 1] + y[voxel_index + vdim.x - 1];

		if (row > 0)
			div += x[voxel_index] - x[voxel_index - vdim.x] - z[voxel_index - vdim.x + vdim.z*vdim.y*vdim.x] + y[voxel_index - vdim.x + vdim.z*vdim.y*vdim.x];
		else
			div += x[voxel_index] - x[voxel_index + (vdim.y - 1)*vdim.x] - z[voxel_index + (vdim.y - 1)*vdim.x + vdim.z*vdim.y*vdim.x] + y[voxel_index + (vdim.y - 1)*vdim.x + vdim.z*vdim.y*vdim.x];

		if (blockIdx.z > 0)
			div += x[voxel_index] - x[voxel_index - vdim.y*vdim.x] - z[voxel_index - vdim.y*vdim.x + 2 * vdim.z*vdim.y*vdim.x] + y[voxel_index - vdim.y*vdim.x + 2 * vdim.z*vdim.y*vdim.x];
		else
			div += x[voxel_index] - x[voxel_index + vdim.y*vdim.x*(vdim.z - 1)] - z[voxel_index + vdim.y*vdim.x*(vdim.z - 1) + 2 * vdim.z*vdim.y*vdim.x] + y[voxel_index + vdim.y*vdim.x*(vdim.z - 1) + 2 * vdim.z*vdim.y*vdim.x];

		//x = x - mu/ro*(trans(Ktv)*(Ktv*x - Ztv + Ytv) + (x - Znlm + Ynlm))
		x[voxel_index] = x[voxel_index] - mu*ro*(div + x[voxel_index] - z_nlm[voxel_index] + y_nlm[voxel_index]);

		//Nonnegativity constraint
		if (nonnegativity && (x[voxel_index] < 0))
			x[voxel_index] = 0;
	}
}

__global__ void update_y_ladmm_kernel(float* y, const float* x, const float* z)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		float grad;
		if (col < (vdim.x - 1))
			grad = x[voxel_index + 1] - x[voxel_index];
		else
			grad = x[voxel_index - col] - x[voxel_index];
			//grad = -x[voxel_index];

		//First element
		y[voxel_index] = y[voxel_index] + grad - z[voxel_index];

		if (row < (vdim.y - 1))
			grad = x[voxel_index + vdim.x] - x[voxel_index];
		else
			grad = x[voxel_index - row*vdim.x] - x[voxel_index];
			//grad = -x[voxel_index];

		//Second element
		y[voxel_index + vdim.z*vdim.y*vdim.x] = y[voxel_index + vdim.z*vdim.y*vdim.x] + grad - z[voxel_index + vdim.z*vdim.y*vdim.x];

		if (blockIdx.z < (vdim.z - 1))
			grad = x[voxel_index + vdim.y*vdim.x] - x[voxel_index];
		else
			grad = x[voxel_index - blockIdx.z*vdim.y*vdim.x] - x[voxel_index];
			//grad = -x[voxel_index];

		//Third element
		y[voxel_index + 2 * vdim.z*vdim.y*vdim.x] = y[voxel_index + 2 * vdim.z*vdim.y*vdim.x] + grad - z[voxel_index + 2 * vdim.z*vdim.y*vdim.x];
	}	
}

//y_nlm = y_nlm + x - z_nlm
__global__ void update_y_ladmm_kernel_2(float* y_nlm, const float* x, const float* z_nlm)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;
		
		//Update Ynlm
		y_nlm[voxel_index] = y_nlm[voxel_index] + x[voxel_index] - z_nlm[voxel_index];
	}
}

//y = y + x - z
__global__ void update_y_admm_kernel(float* y, const float* x, const float* z)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;

		y[voxel_index] = y[voxel_index] + x[voxel_index] - z[voxel_index];
	}
}

//x = x_old - tau*A^T*z
__global__ void update_x_pd_kernel(float* x, const float* z)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		float div = -z[voxel_index] - z[voxel_index + vdim.z*vdim.y*vdim.x] - z[voxel_index + 2 * vdim.z*vdim.y*vdim.x];

		//If not in X limit, add the Fx of previous voxel. Same for the other axis
		if (col > 0)
			div += z[voxel_index - 1];

		if (row > 0)
			div += z[voxel_index - vdim.x + vdim.z*vdim.y*vdim.x];

		if (blockIdx.z > 0)
			div += z[voxel_index - vdim.y*vdim.x + 2 * vdim.z*vdim.y*vdim.x];

		x[voxel_index] = x[voxel_index] - tau*div;

		//Nonnegativity constraint
		if (nonnegativity && (x[voxel_index] < 0))
			x[voxel_index] = 0;
	}	
}

__global__ void update_y_pd_kernel(float* y, const float* x_old, const float* x)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//y = x + theta(x - x_old)
		y[voxel_index] = x[voxel_index] + theta*(x[voxel_index] - x_old[voxel_index]);
	}	
}

//z = prox_conj_g(z + gamma*A*y)
//prox_conj_g(v) = v - prox_g(v) //without lambda regularizer
//prox_conj_g(v) = v - (1/lambda)prox_g(lambda*v) //with lambda regularizer
//hence, z = z + gamma*A*y - prox_g(z+gamma*A*y)
__global__ void update_z_pd_kernel(float* z, const float* y)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((row < vdim.y) && (col < vdim.x))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//z + gamma_pd*A*y
		float _z;
		if (col < (vdim.x - 1))
			_z = z[voxel_index] + gamma_pd*(y[voxel_index + 1] - y[voxel_index]);
		else
			_z = z[voxel_index] + gamma_pd*(-y[voxel_index]);

		//First element
		z[voxel_index] = _z - sign(_z)*fmaxf(0.0f, abs(_z) - sigma);

		if (row < (vdim.y - 1))
			_z = z[voxel_index + vdim.z*vdim.y*vdim.x] + gamma_pd*(y[voxel_index + vdim.x] - y[voxel_index]);
		else
			_z = z[voxel_index + vdim.z*vdim.y*vdim.x] + gamma_pd * (y[voxel_index] - y[voxel_index - vdim.x]);
			//_z = z[voxel_index + vdim.z*vdim.y*vdim.x] + gamma_pd*(-y[voxel_index]);

		//Second element
		z[voxel_index + vdim.z*vdim.y*vdim.x] = _z - sign(_z)*fmaxf(0.0f, abs(_z) - sigma);

		if (blockIdx.z < (vdim.z - 1))
			_z = z[voxel_index + 2 * vdim.z*vdim.y*vdim.x] + gamma_pd*(y[voxel_index + vdim.y*vdim.x] - y[voxel_index]);
		else
			//_z = z[voxel_index + 2 * vdim.z*vdim.y*vdim.x] + gamma_pd * (y[voxel_index] - y[voxel_index - vdim.y*vdim.x]);
			_z = z[voxel_index + 2 * vdim.z*vdim.y*vdim.x] + gamma_pd*(-y[voxel_index]);

		//Third element
		z[voxel_index + 2 * vdim.z*vdim.y*vdim.x] = _z - sign(_z)*fmaxf(0.0f, abs(_z) - sigma);
	}	
}

//volume = scalar*volume
__global__ void scale_volume_kernel(float* d_rec_vol, float scalar)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((col < vdim.x) && (row < pdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//d_rec_vol = scalar*d_rec_vol
		d_rec_vol[voxel_index] = scalar * d_rec_vol[voxel_index];
	}
}

//Element wise multiplication of two volumes
__global__ void multiply_volumes_kernel(const float* d_vol1, const float* d_vol2, float* d_dst)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((col < vdim.x) && (row < pdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		d_dst[voxel_index] = d_vol1[voxel_index] * d_vol2[voxel_index];
	}
}

//Element wise difference of two volumes
__global__ void substract_volumes_kernel(const float* d_vol1, const float* d_vol2, float* d_dst)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;

		d_dst[voxel_index] = d_vol1[voxel_index] - d_vol2[voxel_index];
	}
}

//Element wise sum of two volumes
__global__ void add_volumes_kernel(const float* d_vol1, const float* d_vol2, float* d_dst)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;

		d_dst[voxel_index] = d_vol1[voxel_index] + d_vol2[voxel_index];
	}
}

//Returns l2norm of a volume = sqrt(sum of all elements^2)
__global__ void volume_normal_kernel(const float* d_vol, float* d_slice)
{
	//Get k
	int k = threadIdx.x;

	float slice = 0;
	int voxel_index;

	for (int i = 0; i < vdim.x; i++)
	{
		for (int j = 0; j < vdim.y; j++)
		{
			voxel_index = i + j*vdim.x + k*vdim.y*vdim.x;
			slice += d_vol[voxel_index]*d_vol[voxel_index];
		}
	}	

	d_slice[k] = slice;
}

//Returns sum of all elements
__global__ void volume_sum_kernel(const float* d_vol, float* d_slice)
{
	//Get the voxel index i, j, k
	int k = threadIdx.x;

	float slice = 0;

	for (int i = 0; i < vdim.x; i++)
	{
		for (int j = 0; j < vdim.y; j++)
		{
			slice += d_vol[i + j * vdim.x + k * vdim.y*vdim.x];
		}
	}

	d_slice[k] = slice;
}

//Returns dot product of two volumes = sum of element wise multiplications
__global__ void volume_dot_kernel(const float* d_vol1, const float* d_vol2, float* d_slice)
{
	//Get the voxel index i, j, k
	int k = threadIdx.x;

	float slice = 0;
	int voxel_index;

	for (int i = 0; i < vdim.x; i++)
	{
		for (int j = 0; j < vdim.y; j++)
		{
			voxel_index = i + j * vdim.x + k * vdim.y*vdim.x;
			slice += d_vol1[voxel_index]*d_vol2[voxel_index];
		}
	}

	d_slice[k] = slice;
}

//Call <<<1, vdim.z>>>
//Stores each slice's max in per_slice[slice]
__global__ void volume_max_kernel(const float* d_vol, float* d_slice, uint3 dim)
{
	//Get the slice number
	int k = threadIdx.x;

	float max = -100000000;
	int voxel_index;

	//Get the maximum of the slice
	for (int i = 0; i < dim.x; i++)
	{
		for (int j = 0; j < dim.y; j++)
		{
			voxel_index = i + j*dim.x + k*dim.y*dim.x;
			if (d_vol[voxel_index] > max)
				max = d_vol[voxel_index];
		}
	}

	//Store the maximum of the slice
	d_slice[k] = max;
}

//Call <<<1, vdim.z>>>
//Stores each slice's min in per_slice[slice]
__global__ void volume_min_kernel(const float* d_vol, float* d_slice, uint3 dim)
{
	//Get the slice index
	int k = threadIdx.x;	

	float min = 10000000;
	int voxel_index;

	//Get the minimum of the slice
	for (int i = 0; i < dim.x; i++)
	{
		for (int j = 0; j < dim.y; j++)
		{
			voxel_index = i + j*dim.x + k* dim.y*dim.x;
			if (d_vol[voxel_index] < min)
				min = d_vol[voxel_index];
		}
	}

	//Store the minimum of the slice
	d_slice[k] = min;
}


//For each voxel
//v = scale*(v - min / max - min)
__global__ void normalize_volume_intensity_kernel(float* d_vol, float max, float min, float scale)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		d_vol[voxel_index] = scale * ((d_vol[voxel_index] - min) / (max - min));
	}
}

__global__ void volume_histogram_kernel(float* d_vol, float max, float min, int* d_vol_hist)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	if ((col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Normalize to range [0, number_of_bins-1]
		d_vol[voxel_index] = rintf((float)(number_of_bins-1)*((d_vol[voxel_index] - min) / (max - min)));

		int value = rintf(d_vol[voxel_index]);

		atomicAdd(&d_vol_hist[value], 1);
	}
}

//Lookup table style
//Old values are the keys
//The table is the scaled cumulative probabilities
__global__ void histogram_equalization_kernel(float* d_vol, float* d_cumulative_probabilities)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	if ((col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Get int value of voxel as key
		int key = d_vol[voxel_index];

		//Use key as value in lookup table of cumulative probabilities
		d_vol[voxel_index] = d_cumulative_probabilities[key];
	}
}

__global__ void crop_vol_kernel(float* d_vol, float* d_crop_vol, int pad, uint3 odim, uint3 ndim)
{
	//Get the voxel index i, j, k
	int x = threadIdx.x;
	int y = blockIdx.x;
	int z = blockIdx.y;
	d_crop_vol[x + y*ndim.x + z*ndim.y*ndim.x] = d_vol[(pad + x) + y*odim.x + z*odim.y*odim.x];
}

__global__ void crop_result_kernel(float* d_vol, float* d_crop_vol, uint3 odim, uint3 ndim)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	if ((col < ndim.x) && (row < ndim.y))
	{
		d_crop_vol[col + row*ndim.x] = d_vol[(padding + col) + row*odim.x];
	}
}

//Returns ray origin for each pixel
//Used in ray based forward projection
//Origin is at the center of the volume
//Y coordinate matches the volume coordinate for correct interpolation
__device__ float3 get_ray_origin(int col)
{
	//Rotation must be around volume center -> Volume center is the origin for this rotation
	//Center properly before rotation. Volume horozintal center and planes horizontal center must be aligned 
	//-> projection horizontal center must be zero
	//-> substract pdelta.x in horizontal dimension to center
	//rotation is along y axis -> no need to center y (unchanged)
	//Projection plane is -source_d -vdelta.z from volume center.z!

	//For non - tiled, the y coordinate is the same in the image plane and inside the volume
	//For tiled, we need the y coordinate of the ray inside the volume tile for the volume interpolation
	//It's the same
	float3 pos = make_float3(col - pdelta.x, blockIdx.y*blockDim.y + threadIdx.y, -source_object_distance - vdelta.z);

	//Rotate according to current projection angle
	//Initial position of volume rendering, from source plane
	rotate_clockwise(pos);

	//'Decenter' to volume coordinates
	pos = pos + make_float3(vdelta.x, 0, vdelta.z);
	return pos;
}

//Returns weight Wij of voxel j on pixel i
//r is the distance from voxel to pixel
__device__ float get_weight(float r)
{

	//Generate index accordingly to r
	if (r >= 2.0)
		return 0;
	else
	{
		//Multipy by 10000, now each int is an index
		//Min index = 0, max index = 20000
		r = 10000*r;

		if (r == floor(r))
			return kernel_lookup[(int)r];
		else
			//Linearly interpolate previous and posterior points
			return (r - floor(r))*kernel_lookup[(int)floor(r)] + (ceil(r) - r)*kernel_lookup[(int)ceil(r)];
	}
}

__global__ void linearize_projections_kernel(float* projection)
{
	//Get pixel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	if ((column < pdim.x) && (row < pdim.y))
	{
		//Global pixel index
		unsigned int pixel_index = row*pdim.x + column;

		//If 0 -> Masked
		if (projection[pixel_index] > 0)
		{
			//Apply logarithm preprocessing.
			projection[pixel_index] = -1.0f*logf(fmaxf(projection[pixel_index], i_0 / 1000000000.0) / i_0);
		}
		else
			projection[pixel_index] = 0; //Leave mask untouched and mask negative values
	}	
}

__global__ void delinearize_volume_kernel(float* data)
{
	//Get pixel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	if ((column < vdim.x) && (row < vdim.y))
	{
		//Pixel index
		unsigned int pixel_index = row*vdim.x + column;

		//Apply logarithm preprocessing.
		data[pixel_index] = i_0*expf(-1.0f*data[pixel_index]);
	}
}

__global__ void mask_projections_kernel(float* projections, float* masks)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		if(masks[voxel_index] == 0)
			projections[voxel_index] = 0;
	}
}