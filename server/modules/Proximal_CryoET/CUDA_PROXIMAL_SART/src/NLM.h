#pragma once
#include "global_definitions.h"

//The weight function is a decaying exponential function
//Depending on the squared weighted Euclidean distance between the patches.
//The difference of each pixel is weighted by a Gaussian kernel
//depending on the distance to the center pixel
__device__ float get_NLM_2D_weight(const float* volume, int3 voxel1, int3 voxel2)
{
	float distance = 0;
	float weight_sum = 0;

	//Sigma value for Gaussian kernel is estimated as ((nlm_w-1) / 4)
	//As in scikit nlm implementation. The expresion below corresponds to 2*sigma^2
	float twosigmasigma = ((float)(nlm_w*nlm_w) - 2.0*(float)nlm_w + 1.0)/8.0;

	//For each voxel in the patches
	for (int x = -nlm_w; x <= nlm_w; x++)
	{
		for (int y = -nlm_w; y <= nlm_w; y++)
		{
			//TODO: exp of large negative numbers will be 0, so we'd better stop

			//Get current position in the patches
			int2 v1 = make_int2(voxel1.x + x, voxel1.y + y);
			int2 v2 = make_int2(voxel2.x + x, voxel2.y + y);

			//Check boundary conditions
			if ((v1.x >= 0) && (v1.x < vdim.x) && (v1.y >= 0) && (v1.y < vdim.y) &&
				(v2.x >= 0) && (v2.x < vdim.x) && (v2.y >= 0) && (v2.y < vdim.y))
			{				
				float weight = expf(-1.0*(x*x + y*y) / twosigmasigma);
				weight_sum += weight;
				distance += weight*powf(volume[voxel1.z*vdim.y*vdim.x + v1.y*vdim.x + v1.x] - volume[voxel2.z*vdim.y*vdim.x + v2.y*vdim.x + v2.x], 2);
			}								
		}
	}
	return expf(-distance/(weight_sum*nlm_h)); //nlm_h holds h squared to save one multiplication
}

//Same idea, but comparing patches across XZ plane
__device__ float get_NLM_2D_weight_xz(const float* volume, int2 voxel1, int2 voxel2)
{
	float distance = 0;
	float weight_sum = 0;

	//Sigma value for Gaussian kernel is estimated as ((nlm_w-1) / 4)
	//As in scikit nlm implementation. The expresion below corresponds to 2*sigma^2
	float twosigmasigma = ((float)(nlm_w*nlm_w) - 2.0*(float)nlm_w + 1.0) / 8.0;

	//For each voxel in the patches
	for (int x = -nlm_w; x <= nlm_w; x++)
	{
		for (int z = -nlm_w; z <= nlm_w; z++)
		{
			//Get current position in the patches
			int3 v1 = make_int3(voxel1.x + x, voxel1.y, blockIdx.z + z);
			int3 v2 = make_int3(voxel2.x + x, voxel2.y, blockIdx.z + z);

			//Check boundary conditions
			if ((v1.x >= 0) && (v1.x < vdim.x) && (v1.z >= 0) && (v1.z < vdim.z) &&
				(v2.x >= 0) && (v2.x < vdim.x) && (v2.z >= 0) && (v2.z < vdim.z))
			{
				float weight = expf(-1.0*(x*x + z*z) / twosigmasigma);
				weight_sum += weight;
				distance += weight * powf(volume[v1.z*vdim.y*vdim.x + v1.y*vdim.x + v1.x] - volume[v2.z*vdim.y*vdim.x + v2.y*vdim.x + v2.x], 2);
			}
		}
	}
	return expf(-distance / (weight_sum*nlm_h)); //nlm_h holds h squared to save one multiplication
}


//2D NLM SLICE BY SLICE Z AXIS
//Size of search window is (2s+1)(2s+1)
//Size of patches is (2w+1)(2w+1)
//h is the filtering parameter (typically depends on stdev of noise)
//nlm_skip, defaul = 1 (original nlm) can be used to skip some pixels
//and use larger search zones without increasing the computation time to much
__global__ void NLM_2D_kernel(const float* volume, float* denoised)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that we are not in padding region
	if ((col >= padding) && (col < vdim.x - padding) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Initialize result and weight_sum
		float result = 0, weight_sum = 0;

		//For each voxel inside search region
		for (int x = -nlm_s; x <= nlm_s; x+=nlm_skip)
		{
			for (int y = -nlm_s; y <= nlm_s; y+=nlm_skip)
			{					
				//Check boundary condition
				if((row + y >= 0) && (row + y < vdim.y) && (col + x >= 0) && (col + x < vdim.x))
				{
					//In the original work, reference voxel is weighted by maximum weight
					//to avoid giving too much relevance (as in paper description)
					//However, the result is not so different, some implementations (e.g. scikit) don't do it
					float weight;
					if(nlm_weight_xz)
						weight = get_NLM_2D_weight_xz(volume, make_int2(col, row), make_int2(col + x, row + y));
					else
						weight = get_NLM_2D_weight(volume, make_int3(col, row, blockIdx.z), make_int3(col + x, row + y, blockIdx.z));

					//Accumulate weight and value
					weight_sum += weight;
					result += weight * volume[blockIdx.z*vdim.y*vdim.x + (row + y)*vdim.x + (col + x)];
				}				
			}
		}

		//Normalize
		denoised[voxel_index] = result / weight_sum;
	}
}

//Same idea
//Transfer from XY to XZ
__global__ void NLM_2D_XZ_kernel(const float* volume, float* denoised)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that we are not in padding region
	if ((col >= padding) && (col < vdim.x - padding) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row * vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Initialize result and weight_sum
		float result = 0, weight_sum = 0;

		//For each voxel inside search region
		for (int x = -nlm_s; x <= nlm_s; x += nlm_skip)
		{
			for (int z = -nlm_s; z <= nlm_s; z += nlm_skip)
			{
				//Check boundary condition
				if ((blockIdx.z + z >= 0) && (blockIdx.z + z < vdim.z) && (col + x >= 0) && (col + x < vdim.x))
				{
					float weight;
					weight = get_NLM_2D_weight(volume, make_int3(col, row, blockIdx.z), make_int3(col + x, row, blockIdx.z + z));

					//Accumulate weight and value
					weight_sum += weight;
					result += weight*volume[(blockIdx.z+z)*vdim.y*vdim.x + row*vdim.x + (col + x)];
				}
			}
		}

		//Normalize
		denoised[voxel_index] = result / weight_sum;
	}
}

//3D Version
__device__ float get_NLM_3D_weight(const float* volume, int3 voxel1, int3 voxel2)
{
	float distance = 0;
	float weight_sum = 0;

	//Sigma value for Gaussian kernel is estimated as ((nlm_w-1) / 4)
	//As in scikit nlm implementation. The expresion below corresponds to 2*sigma^2
	float twosigmasigma = ((float)(nlm_w*nlm_w) - 2.0*(float)nlm_w + 1.0) / 8.0;

	//For each voxel in the patches
	for (int x = -nlm_w; x <= nlm_w; x++)
	{
		for (int y = -nlm_w; y <= nlm_w; y++)
		{
			for (int z = -nlm_w; z <= nlm_w; z++)
			{
				//Get current position in the patches
				int3 v1 = make_int3(voxel1.x + x, voxel1.y + y, voxel1.z + z);
				int3 v2 = make_int3(voxel2.x + x, voxel2.y + y, voxel2.z + z);

				//Check boundary conditions
				if ((v1.x >= 0) && (v1.x < vdim.x) && (v1.y >= 0) && (v1.y < vdim.y) && (v1.z >= 0) && (v1.z < vdim.z) &&
					(v2.x >= 0) && (v2.x < vdim.x) && (v2.y >= 0) && (v2.y < vdim.y) && (v2.z >= 0) && (v2.z < vdim.z))
				{
					float weight = expf(-1.0*(x*x + y*y + z*z) / twosigmasigma);
					weight_sum += weight;
					distance += weight*powf(volume[v1.z*vdim.y*vdim.x + v1.y*vdim.x + v1.x] - volume[v2.z*vdim.y*vdim.x + v2.y*vdim.x + v2.x], 2);				
				}
			}			
		}
	}
	return expf(-distance/(weight_sum*nlm_h)); //nlm_h holds h squared to save one multiplication
}


//3D NLM
//Size of search window is (2s+1)(2s+1)(2s+1)
//Size of patches is (2w+1)(2w+1)(2w+1)
//h is the filtering parameter (typically depends on stdev of noise)
__global__ void NLM_3D_kernel(const float* volume, float* denoised)
{
	//Get voxel's row and column
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that we are not in padding region or outside the volume
	if ((col >= padding) && (col < vdim.x - padding) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Initialize result and weight_sum
		float result = 0, weight_sum = 0;

		//For each voxel inside cubic search region
		for (int x = -nlm_s; x <= nlm_s; x+=nlm_skip)
		{
			for (int y = -nlm_s; y <= nlm_s; y+=nlm_skip)
			{
				for (int z = -nlm_s; z <= nlm_s; z+=nlm_skip)
				{
					//Check boundary condition
					if ((col + x >= 0) && (col + x < vdim.x) && (row + y >= 0) && (row + y < vdim.y) && (blockIdx.z + z >= 0) && (blockIdx.z + z < vdim.z))
					{

						float weight = get_NLM_3D_weight(volume, make_int3(col, row, blockIdx.z), make_int3(col + x, row + y, blockIdx.z + z));

						//Accumulate weight and value
						weight_sum += weight;
						result += weight * volume[(blockIdx.z + z)*vdim.y*vdim.x + (row + y)*vdim.x + (col + x)];
					}
				}				
			}
		}

		//Normalize
		denoised[voxel_index] = result / weight_sum;
	}
}