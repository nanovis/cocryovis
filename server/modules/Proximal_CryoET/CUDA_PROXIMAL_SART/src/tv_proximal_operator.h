///Total variation proximal operator
#pragma once

#include "global_definitions.h"

//Proximal operator of g(u) is soft thresholding function:
//The max and product are element-wise operations: z = prox_g(kx + y) = sign(kx + y)*max(0, abs(kx + y) - sigma)
//One thread per volume voxel, each thread updates three elements of the volume gradient
//Check TRex paper TV regularizer section for details
__global__ void atv_po_kernel(const float* x, const float* y, float* z)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	if(reconstruction_region(col) && (col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//If we are in the x limit, assume the values outside the volume to be zero
		//The gradient is the negative of the voxel value. The same applies for y and z
		float grad;
		if (col < (vdim.x - 1))
			grad = x[voxel_index + 1] - x[voxel_index];
		else
			grad = x[voxel_index] - x[voxel_index - 1];

		//First element
		z[voxel_index] = sign(grad + y[voxel_index])*fmaxf(0.0f, abs(grad + y[voxel_index]) - sigma);

		if (row < (vdim.y - 1))
			grad = x[voxel_index + vdim.x] - x[voxel_index];
		else
			grad = x[voxel_index] - x[voxel_index - vdim.x];

		//Second element
		z[voxel_index + vdim.z*vdim.y*vdim.x] = sign(grad + y[voxel_index + vdim.z*vdim.y*vdim.x])*fmaxf(0.0f, abs(grad + y[voxel_index + vdim.z*vdim.y*vdim.x]) - sigma);

		if (blockIdx.z < (vdim.z - 1))
			grad = x[voxel_index + vdim.y*vdim.x] - x[voxel_index];
		else
			grad = x[voxel_index] - x[voxel_index - vdim.y*vdim.x];

		//Third element
		z[voxel_index + 2 * vdim.z*vdim.y*vdim.x] = sign(grad + y[voxel_index + 2 * vdim.z*vdim.y*vdim.x])*fmaxf(0.0f, abs(grad + y[voxel_index + 2 * vdim.z*vdim.y*vdim.x]) - sigma);
	}
}

