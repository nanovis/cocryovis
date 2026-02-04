///Huber proximal operator
#pragma once

#include "global_definitions.h"

//Huber TV proximal operator
//v = Kx + y
//for each element of v
//v = (1/(1+lambda))*v, if abs(v) <= sigma + sigma*lambda
//v = v - lambda*sigma, if v > sigma + sigma*lambda
//v = v + lambda*sigma, if v < - (sigma + sigma*lambda)
__global__ void htv_po_kernel(const float* x, const float* y, float* z)
{
	//Get slice voxel index
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	if(reconstruction_region(col) && (col < vdim.x) && (row < vdim.y))
	{
		const unsigned int voxel_index = col + row*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//If we are in the x limit, assume 'reflect mode' padding
		//The same applies for y and z
		float grad;
		if (col < (vdim.x - 1))
			grad = x[voxel_index + 1] - x[voxel_index];
		else
			grad = x[voxel_index] - x[voxel_index - 1];

		//First element
		float v = grad + y[voxel_index];
		if (abs(v) <= (sigma + sigma*huber_lambda))
			z[voxel_index] = (1 / (1 + huber_lambda))*v;
		else
			z[voxel_index] = sign(v)*(abs(v) - sigma*huber_lambda);

		if (row < (vdim.y - 1))
			grad = x[voxel_index + vdim.x] - x[voxel_index];
		else
			grad = x[voxel_index] - x[voxel_index - vdim.x];

		//Second element
		v = grad + y[voxel_index + vdim.z*vdim.y*vdim.x];
		if (abs(v) <= (sigma + sigma*huber_lambda))
			z[voxel_index + vdim.z*vdim.y*vdim.x] = (1 / (1 + huber_lambda))*v;
		else
			z[voxel_index + vdim.z*vdim.y*vdim.x] = sign(v)*(abs(v) - sigma * huber_lambda);

		if (blockIdx.z < (vdim.z - 1))
			grad = x[voxel_index + vdim.y*vdim.x] - x[voxel_index];
		else
			grad = x[voxel_index] - x[voxel_index - vdim.y*vdim.x];

		//Third element
		v = grad + y[voxel_index + 2 * vdim.z*vdim.y*vdim.x];
		if (abs(v) <= (sigma + sigma*huber_lambda))
			z[voxel_index + 2*vdim.z*vdim.y*vdim.x] = (1 / (1 + huber_lambda))*v;
		else
			z[voxel_index + 2*vdim.z*vdim.y*vdim.x] = sign(v)*(abs(v) - sigma * huber_lambda);
	}
}

