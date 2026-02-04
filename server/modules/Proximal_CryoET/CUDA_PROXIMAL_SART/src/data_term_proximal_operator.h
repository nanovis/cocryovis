//Proximal operator of the data term
//solved using SART
#pragma once

#include "global_definitions.h"

float get_angle()
{
	if (angles_list_filename == "")
		return starting_angle + angle_step * current_projection;
	else
		return angles_list[current_projection];
}

__global__ void forward_projection_kernel(const float* proj_data, const float* rec_vol, float* corr_img)
{
	//Row and column indexes 
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile*tile_size - (number_extra_rows/2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Projection image boundary check
	if ((row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y) && (col < pdim.x))
	{
		//current_tile is 0 for non pw
		const unsigned int pixel_index = col + row*pdim.x;

		//Ray origin in world coordinates (from i, j pixel in source plane)
		float3 pos = get_ray_origin(col);

		//Entry and exit points of the ray in the volume
		float3 entry_pos = make_float3(0, 0, 0);
		float3 exit_pos = make_float3(0, 0, 0);

		//Variable to store ray-sum result
		float ray_sum = 0;

		//Move along the ray
		//The number of steps / samples is M = ceil(2 * source_object_distance / sample_rate);
		for (int m = 0; m <= M; m++)
		{
			//If the current position is 'inside the volume'
			if ((pos.x <= vdim.x - 1) && (pos.x >= 0) &&
				//Y never changes and is always inside
				(pos.z <= vdim.z - 1) && (pos.z >= 0))
			{
				//Store first sampled point as entry point
				//TODO: Compute entry and exit points outside, once and exactly!
				if ((entry_pos.x == 0) && (entry_pos.y == 0) && (entry_pos.z == 0))
				{
					entry_pos = pos;
					entry_pos.x = entry_pos.x + 0.000000001; //To prevent funny things if the entry point was 0, 0, 0
				}

				//Update ray sum
				ray_sum += sample_rate*interpol(rec_vol, pos, vdim);

				//Update last sampled position
				exit_pos = pos;
			}
			pos = pos + sample_rate*dir;
		}

		////Get ray's length inside the volume
		float ray_length = length(exit_pos - entry_pos);

		//Correction = (original - FP)/ray_length.
		if ((ray_length > 0) && (proj_data[pixel_index + current_projection * pdim.y*pdim.x] > 0))
			corr_img[pixel_index] = (proj_data[pixel_index + current_projection * pdim.y*pdim.x] - ray_sum) / ray_length;
		else
			corr_img[pixel_index] = 0; //If the ray did not intersect the volume or projection is 0 (masked), there is no correction.
	}
}

__global__ void back_projection_kernel(float* rec_vol, const float* corr_img)
{
	//For the geometric operations
	//All the considered positions and directions must be consistent
	//e.g. all of them should be in the 'world coordinates'

	//Get slice voxel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile*tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((column < vdim.x) && (row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y))
	{
		const unsigned int voxel_index = column + (blockIdx.y*blockDim.y + threadIdx.y)*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Voxel position (origin at volume center)
		const float3 voxel_pos = make_float3(column - vdelta.x, row - vdelta.y, blockIdx.z - vdelta.z);

		//Get value t at which voxel_pos (e) + td is in the projection plane with point pip and normal n;
		//t = (pip - e)*n / d*n
		//Given the parallel projection, the ray's direction and the normal to the projection plane are always the same
		//d = n
		//d is always (0, 0, 1) rotated(?). Should it be normalized?
		//t = (pip - e)*d / d*d
		//The norm of d is always one
		//t = (pip - e)*d
		//d.y is always zero
		//t = (pip.x - e.x)*d.x + (pip.z - e.z)*d.z
		float t = (pip.x - voxel_pos.x)*dir.x + (pip.z - voxel_pos.z)*dir.z;
		//float t = (pip.z - voxel_pos.z);

		//Get the projection of the voxel in the detector plane
		float3 pvox = make_float3(voxel_pos.x + t * dir.x, voxel_pos.y, voxel_pos.z + t * dir.z);

		//rotate pvox back to original source plane, inverse rotation, cos(-x) = cos(x), sin(-t) = -sin(t)
		rotate_anticlockwise(pvox);

		//If the x, y position correspond to a correction pixel, apply correction
		if ((pvox.x <= pdelta.x) && (pvox.x >= -pdelta.x) &&
			(pvox.y <= pdelta.y) && (pvox.y >= -pdelta.y))
		{
			//Apply correction with bilinear interpolation
			rec_vol[voxel_index] += chill_factor*interpol2D(corr_img, make_float2(pvox.x + pdelta.x, pvox.y + pdelta.y), make_uint2(pdim.x, pdim.y));

			//Positivity constraint
			if (nonnegativity && (rec_vol[voxel_index] < 0.0f))
				rec_vol[voxel_index] = 0.0f;
		}
	}
}

//Perform one SART iteration (all projections once)
void sart(int iter = 0)
{
	clock_t start_time = clock();

	for (int tile = 0; tile < number_of_tiles; tile++)
	{
		current_tile = tile;

		//Initialice device piece
		cudaStatus = cudaMemset(d_rec_vol, 0.0f, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing piece failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}		

		for (int data_iters = 0; data_iters < data_term_iters; data_iters++)
		{
			//Shuffle projection order
			if ((current_tile == 0))
			{
				if (random_projection_order)
				{
					std::random_device rd;
					std::mt19937 g(rd());
					std::shuffle(projections.begin(), projections.end(), g);
				}
				pw_projections.push_back(projections);
			}

			for (unsigned int i = 0; i < pdim.z; i++)
			{
				//printf("\rProjection %d/%d", i + 1, pdim.z);
				//Update current projection
				current_projection = pw_projections[data_iters][i];

				//Angle required in radians for cos and sin functions
				float angle = get_angle();
				angle = radians(angle);

				//Update cosine and sine for point rotations
				cost = cos(angle);
				sint = sin(angle);

				//Update direction, simply is (0, 0, 1) rotated.
				//The norm is always one
				dir = make_float3(sint, 0, cost);

				//Update point in plane 'pip'
				//corresponds to center of projection image (sensor)
				//From volume center, (0,0,vdelta.z+source_object_distance)
				//rotated accordingly to the current projection
				pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));
				//pip = make_float3(sint*source_object_distance, 0, cost*source_object_distance);

				//Perform forward projection
				forward_projection_kernel <<<FPgrid, block >>> (d_proj_data, d_rec_vol, d_corr_img);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "tiled forward projection kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching tiled FP kernel:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				//Perform backprojection
				back_projection_kernel <<<BPgrid, block>>> (d_rec_vol, d_corr_img);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "tiled back projection kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching tiled BP kernel:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}
		}
		//Copy d_rec_vol into h_rec_vol corresponding piece
		copy_piece_to_host();
	}
	double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
	printf("\nTime taken for last sart iteration: %f s\n", elapsed_secs);
}

void sirt(int iter = 0)
{
	clock_t start_time = clock();

	for (int tile = 0; tile < number_of_tiles; tile++)
	{
		current_tile = tile;

		//Initialice device piece
		cudaStatus = cudaMemset(d_rec_vol, 0.0f, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing piece failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		for (unsigned int iters = 0; iters < data_term_iters; iters++)
		{			
			//Shuffle projection order
			if (current_tile == 0)
			{
				if (random_projection_order)
				{
					std::random_device rd;
					std::mt19937 g(rd());
					std::shuffle(projections.begin(), projections.end(), g);
				}
				pw_projections.push_back(projections);
			}

			//First, create the correction images for all projections
			for (unsigned int i = 0; i < pdim.z; i++)
			{
				//Update current projection
				current_projection = pw_projections[iters][i];

				//Required in radians for cos and sin functions
				float angle = get_angle();
				angle = radians(angle);

				//Update cosine and sine for point rotations
				cost = cos(angle);
				sint = sin(angle);

				//Update direction, simply is (0, 0, 1) rotated.
				//The norm is always one
				dir = make_float3(sint, 0, cost);

				//Update point in plane 'pip'
				//corresponds to center of projection image (sensor), in world coords
				//rotated accordingly to the current projection
				//It is simply moving source_object_distance from the origin along current direction
				pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

				//for each y pixel, update_y_kernel
				forward_projection_kernel<<<FPgrid, block>>>(d_proj_data, d_rec_vol, d_corr_imgs + current_projection*pdim.x*pdim.y);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "SIRT FP launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching SIRT FP:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}

			//Then, apply the corrections
			//The correction is the average of all computed correction images
			for (unsigned int i = 0; i < pdim.z; i++)
			{
				//Update current projection
				current_projection = pw_projections[iters][i];

				//Required in radians for cos and sin functions
				float angle = starting_angle + angle_step * current_projection;
				angle = radians(angle);

				//Update cosine and sine for point rotations
				cost = cos(angle);
				sint = sin(angle);

				//Update direction, simply is (0, 0, 1) rotated.
				//The norm is always one
				dir = make_float3(sint, 0, cost);

				//Update point in plane 'pip'
				//corresponds to center of projection image (sensor), in world coords
				//rotated accordingly to the current projection
				//It is simply moving source_object_distance from the origin along current direction
				pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

				//for each voxel, update_x_kernel, keep ray lengths and these things
				back_projection_kernel<<<BPgrid, block>>>(d_rec_vol, d_corr_imgs + current_projection*pdim.x*pdim.y);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "BP SIRT kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching BP SIRT:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}
		}

		//Copy d_rec_vol into h_rec_vol corresponding piece
		copy_piece_to_host();
	}
	double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
	printf("\nTime taken for last sirt iteration: %f s\n", elapsed_secs);
}

//Forward projection using voxel splatting and precomputed kernel integrals
//Stores raysum and weight 'images'
__global__ void FP_splat_kernel(const float* rec_vol, float* raysum_img, float* weigth_img)
{
	//Get voxel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile*tile_size - (number_extra_rows/2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((column < vdim.x) && (row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y))
	{
		//Voxel position (origin at volume center)
		const float3 voxel_pos = make_float3(column - vdelta.x, row - vdelta.y, blockIdx.z - vdelta.z);

		//Splat (project) voxel into detector plane		
		float t = (pip.x - voxel_pos.x)*dir.x + (pip.z - voxel_pos.z)*dir.z; //Get value t at which voxel_pos+t*dir is in the sensor plane, check update_x_kernel for details
		float3 kernel_center = voxel_pos + t*dir; //Project voxel center into sensor plane

		//Rotate back
		rotate_anticlockwise(kernel_center);

		//'Decenter' -> Turn into pixel coordinates
		kernel_center = kernel_center + make_float3(pdelta.x, pdelta.y, 0);

		//If kernel center is in image -> continue!!
		if ((kernel_center.x >= 0) && (kernel_center.x < pdim.x)
			&& (kernel_center.y >= 0) && (kernel_center.y < pdim.y))
		{
			//Voxel index	
			const unsigned int voxel_index = column + (blockIdx.y*blockDim.y + threadIdx.y)*vdim.x + vdim.y*vdim.x*blockIdx.z;

			//Get top left corner for 4x4 grid
			float2 tlcorner = make_float2(kernel_center.x - 2.0, kernel_center.y - 2.0);			

			//TODO: For all pixels inside kernel support not naive
			#pragma unroll
			for (int x = 0; x < 4; x++)
			{
				#pragma unroll
				for (int y = 0; y < 4; y++)
				{
					unsigned int pixel_x = ceil(tlcorner.x + x);
					unsigned int pixel_y = ceil(tlcorner.y + y);

					//If the pixel is inside the image
					if ((pixel_x >= 0) && (pixel_x < pdim.x) &&
						(pixel_y >= 0) && (pixel_y < pdim.y))
					{
						//Get distance from voxel to pixel
						float r = sqrt((kernel_center.x - pixel_x)*(kernel_center.x - pixel_x) + (kernel_center.y - pixel_y)*(kernel_center.y - pixel_y));			

						//The radially symmetric kernel splats as a circle 
						//Center = voxel center projected in plane
						//r = 2 from kernel definition
						if (r < 2)
						{
							atomicAdd(&raysum_img[pixel_x + pixel_y*pdim.x], get_weight(r)*rec_vol[voxel_index]);
							atomicAdd(&weigth_img[pixel_x + pixel_y*pdim.x], get_weight(r));
						}
					}
				}
			}
		}		
	}
}

//Computes correction image from original projection data, 
//raysum and weights, taking relaxation into account
__global__ void correction_img_kernel(const float* proj_data, const float* raysum_img, const float* weigth_img, float* corr_img)
{
	//Row and column indexes 
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile * tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Projection image boundary check
	if ((row >= 0) && (row < pdim.y) && (col < pdim.x))
	{
		//current_tile is 0 for non pw
		const unsigned int pixel_index = col + row*pdim.x;

		//Compute correction image
		if ((weigth_img[pixel_index] > 0) && (proj_data[pixel_index + current_projection * pdim.y*pdim.x] > 0))
			corr_img[pixel_index] = chill_factor * ((proj_data[pixel_index + current_projection * pdim.y*pdim.x] - raysum_img[pixel_index]) / weigth_img[pixel_index]);
		else
			corr_img[pixel_index] = 0;
	}
}

__global__ void BP_splat_kernel(float* rec_vol, const float* corr_img, const float* weight_img)
{
	//Get voxel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile*tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((column < vdim.x) && (row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y))
	{
		const unsigned int voxel_index = column + (blockIdx.y*blockDim.y + threadIdx.y)*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Voxel position (origin at volume center)
		const float3 voxel_pos = make_float3(column - vdelta.x, row - vdelta.y, blockIdx.z - vdelta.z);		

		//Splat (project) voxel into detector plane		
		float t = (pip.x - voxel_pos.x)*dir.x + (pip.z - voxel_pos.z)*dir.z; //Get value t at which voxel_pos+t*dir is in the sensor plane, check update_x_kernel
		float3 kernel_center = voxel_pos + t * dir; //Project voxel center into sensor plane

		//Rotate back
		rotate_anticlockwise(kernel_center);

		//Decenter
		kernel_center = kernel_center + make_float3(pdelta.x, pdelta.y, 0);		

		//Get top left corner
		float2 tlcorner = make_float2(kernel_center.x - 2.0, kernel_center.y - 2.0);

		float correction = 0;
		float total_weight = 0;
		#pragma unroll
		for (int x = 0; x < 4; x++)
		{
			#pragma unroll
			for (int y = 0; y < 4; y++)
			{
				unsigned int pixel_x = ceil(tlcorner.x + x);
				unsigned int pixel_y = ceil(tlcorner.y + y);

				//If the pixel is inside the image
				if ((pixel_x >= 0) && (pixel_x < pdim.x) &&
					(pixel_y >= 0) && (pixel_y < pdim.y))
				{
					//Get distance from voxel to pixel
					float r = sqrt((kernel_center.x - pixel_x)*(kernel_center.x - pixel_x) + (kernel_center.y - pixel_y)*(kernel_center.y - pixel_y));

					if (r < 2)
					{
						correction += corr_img[pixel_x + pixel_y * pdim.x]*get_weight(r);
						total_weight += get_weight(r);
					}
				}					
			}				
		}

		if(total_weight > 0)
			rec_vol[voxel_index] += (correction / total_weight);

		//Clip negative values
		//Positivity constraint
		if ((nonnegativity) && (rec_vol[voxel_index] < 0.0f))
			rec_vol[voxel_index] = 0.0f;
	}	
}

//Perform data_term_iters SART iterations
void sart_splat(int iter = 0)
{
	clock_t start_time = clock();

	for (int tiles = 0; tiles < number_of_tiles; tiles++)
	{
		current_tile = tiles;		

		//Initialice device piece
		cudaStatus = cudaMemset(d_rec_vol, 0.0f, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing piece failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		for (int data_iters = 0; data_iters < data_term_iters; data_iters++)
		{

			//Shuffle projection order
			if ((current_tile == 0))
			{
				if (random_projection_order)
				{
					std::random_device rd;
					std::mt19937 g(rd());
					std::shuffle(projections.begin(), projections.end(), g);
				}
				pw_projections.push_back(projections);
			}

			for (unsigned int i = 0; i < pdim.z; i++)
			{
				//Update current projection
				current_projection = pw_projections[data_iters][i];

				//Angle required in radians for cos and sin functions
				float angle = get_angle();
				angle = radians(angle);

				//Update cosine and sine for point rotations
				cost = cos(angle);
				sint = sin(angle);

				//Update direction, simply is (0, 0, 1) rotated.
				//The norm is always one
				dir = make_float3(sint, 0, cost);

				//point in plane, center of projection image
				//Origin at volume center
				//From volume center, move vdelta.z + source_object_distance along current direction
				pip = make_float3((vdelta.z + source_object_distance)*dir.x, 0, (vdelta.z + source_object_distance)*dir.z);

				//zero out raysum and weight images
				cudaMemset(d_raysum_img, 0, proj_size);
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "SART FP memset error:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
				cudaMemset(d_weight_img, 0, proj_size);
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "SART FP memset error:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				//Perform FP to get raysum_img and weight_imgs
				FP_splat_kernel<<<BPgrid, block>>>(d_rec_vol, d_raysum_img, d_weight_img);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "FP splat kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching FP splat kernel:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				//Create correction image, take relaxation factor lambda into account
				correction_img_kernel <<<FPgrid, block>>> (d_proj_data, d_raysum_img, d_weight_img, d_corr_img);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "correction image kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching correction kernel:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				//Perform backprojection
				BP_splat_kernel <<<BPgrid, block>>> (d_rec_vol, d_corr_img, d_weight_img);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "BP splat kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching BP splat kernel:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}
		}
		copy_piece_to_host();
	}	

	double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
	printf("\nTime taken for last sart_splat iteration: %f s\n", elapsed_secs);
}

void sirt_splat(int iter = 0)
{
	clock_t start_time = clock();

	for (int tile = 0; tile < number_of_tiles; tile++)
	{
		current_tile = tile;

		//Initialice device piece
		cudaStatus = cudaMemset(d_rec_vol, 0.0f, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing piece failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		for (unsigned int iters = 0; iters < data_term_iters; iters++)
		{
			//Shuffle projection order
			if (current_tile == 0)
			{
				if (random_projection_order)
				{
					std::random_device rd;
					std::mt19937 g(rd());
					std::shuffle(projections.begin(), projections.end(), g);
				}
				pw_projections.push_back(projections);
			}

			//First, create the correction images for all projections
			for (unsigned int i = 0; i < pdim.z; i++)
			{
				//Update current projection
				current_projection = pw_projections[iters][i];

				//Required in radians for cos and sin functions
				float angle = get_angle();
				angle = radians(angle);

				//Update cosine and sine for point rotations
				cost = cos(angle);
				sint = sin(angle);

				//Update direction, simply is (0, 0, 1) rotated.
				//The norm is always one
				dir = make_float3(sint, 0, cost);

				//Update point in plane 'pip'
				//corresponds to center of projection image (sensor), in world coords
				//rotated accordingly to the current projection
				//It is simply moving source_object_distance from the origin along current direction
				pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

				//zero out raysum and weight images
				cudaMemset(d_raysum_img, 0.0f, proj_size);
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "SIRT FP memset error:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
				cudaMemset(d_weight_imgs + current_projection*pdim.x*pdim.y, 0.0f, proj_size);
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "SIRT FP memset error:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				//for each y pixel, update_y_kernel
				FP_splat_kernel<<<BPgrid, block>>>(d_rec_vol, d_raysum_img, d_weight_imgs + current_projection*pdim.x*pdim.y);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "SIRT FP launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching SIRT FP:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}				

				//Create correction image, take relaxation factor lambda into account
				correction_img_kernel<<<BPgrid, block >>>(d_proj_data, d_raysum_img, d_weight_imgs + current_projection*pdim.x*pdim.y, d_corr_imgs + current_projection*pdim.x*pdim.y);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "correction image kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching correction kernel:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}			

			//Then, apply the corrections
			//The correction is the average of all computed correction images
			for (unsigned int i = 0; i < pdim.z; i++)
			{
				//Update current projection
				current_projection = pw_projections[iters][i];

				//Required in radians for cos and sin functions
				float angle = starting_angle + angle_step * current_projection;
				angle = radians(angle);

				//Update cosine and sine for point rotations
				cost = cos(angle);
				sint = sin(angle);

				//Update direction, simply is (0, 0, 1) rotated.
				//The norm is always one
				dir = make_float3(sint, 0, cost);

				//Update point in plane 'pip'
				//corresponds to center of projection image (sensor), in world coords
				//rotated accordingly to the current projection
				//It is simply moving source_object_distance from the origin along current direction
				pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

				//for each voxel, update_x_kernel, keep ray lengths and these things
				BP_splat_kernel<<<BPgrid, block>>>(d_rec_vol, d_corr_imgs + current_projection*pdim.x*pdim.y, d_weight_imgs + current_projection*pdim.x*pdim.y);

				// Check for any errors launching the kernel
				cudaStatus = cudaGetLastError();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "BP SIRT kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}

				// cudaDeviceSynchronize waits for the kernel to finish, and returns
				// any errors encountered during the launch.
				cudaStatus = cudaDeviceSynchronize();
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaDeviceSynchronize error after launching BP SIRT:\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}
		}

		//Copy d_rec_vol into h_rec_vol corresponding piece
		copy_piece_to_host();
	}
	double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
	printf("\nTime taken for last sirt plat iteration: %f s\n", elapsed_secs);
}

__global__ void update_y_splat_kernel(const float* proj_data, const float* raysum_img, const float* weigth_img, float* corr_img, float* y_slack)
{
	//Row and column indexes 
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile * tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Projection image boundary check
	if ((row >= 0) && (row < pdim.y) && (col < pdim.x))
	{
		//current_tile is 0 for non pw
		const unsigned int pixel_index = col + row * pdim.x;

		//Compute correction image
		if ((weigth_img[pixel_index] > 0) && (proj_data[pixel_index + current_projection * pdim.y*pdim.x] > 0))
			corr_img[pixel_index] = (lambda*(proj_data[pixel_index + current_projection * pdim.y*pdim.x] - raysum_img[pixel_index]) - y_slack[pixel_index]) / (1 + lambda*weigth_img[pixel_index]);
		else
			corr_img[pixel_index] = 0;			

		//Update y
		y_slack[pixel_index] += chill_factor * corr_img[pixel_index];
	}
}

__global__ void update_x_splat_kernel(float* rec_vol, const float* corr_img, const float* weight_img)
{
	//Get voxel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile * tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((column < vdim.x) && (row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y))
	{
		const unsigned int voxel_index = column + (blockIdx.y*blockDim.y + threadIdx.y)*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Voxel position (origin at volume center)
		const float3 voxel_pos = make_float3(column - vdelta.x, row - vdelta.y, blockIdx.z - vdelta.z);

		//Splat (project) voxel into detector plane		
		float t = (pip.x - voxel_pos.x)*dir.x + (pip.z - voxel_pos.z)*dir.z; //Get value t at which voxel_pos+t*dir is in the sensor plane, check update_x_kernel
		float3 kernel_center = voxel_pos + t * dir; //Project voxel center into sensor plane

		//Rotate back
		rotate_anticlockwise(kernel_center);

		//Decenter
		kernel_center = kernel_center + make_float3(pdelta.x, pdelta.y, 0);

		//Get top left corner
		float2 tlcorner = make_float2(kernel_center.x - 2.0, kernel_center.y - 2.0);

		float correction = 0;
		float total_weight = 0;
		#pragma unroll
		for (int x = 0; x < 4; x++)
		{
			#pragma unroll
			for (int y = 0; y < 4; y++)
			{
				unsigned int pixel_x = ceil(tlcorner.x + x);
				unsigned int pixel_y = ceil(tlcorner.y + y);

				//If the pixel is inside the image
				if ((pixel_x >= 0) && (pixel_x < pdim.x) &&
					(pixel_y >= 0) && (pixel_y < pdim.y))
				{
					//Get distance from voxel to pixel
					float r = sqrt((kernel_center.x - pixel_x)*(kernel_center.x - pixel_x) + (kernel_center.y - pixel_y)*(kernel_center.y - pixel_y));

					if (r < 2)
					{
						correction += corr_img[pixel_x + pixel_y * pdim.x] * get_weight(r);
						total_weight += get_weight(r);
					}
				}
			}
		}

		if (total_weight > 0)
			rec_vol[voxel_index] += chill_factor*(correction / total_weight);

		//Clip negative values
		//Positivity constraint
		if ((nonnegativity) && (rec_vol[voxel_index] < 0.0f))
			rec_vol[voxel_index] = 0.0f;
	}
}

//Perform data_term_iters SART iterations
void sart_splat_proximal_operator(int iter = 0)
{
	for (int data_iters = 0; data_iters < data_term_iters; data_iters++)
	{
		//Shuffle projection order
		if ((current_tile == 0))
		{
			if (random_projection_order)
			{
				std::random_device rd;
				std::mt19937 g(rd());
				std::shuffle(projections.begin(), projections.end(), g);
			}
			pw_projections.push_back(projections);
		}


		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//Update current projection
			current_projection = pw_projections[iter][i];

			//Angle required in radians for cos and sin functions
			float angle = get_angle();
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//point in plane, center of projection image
			//Origin at volume center
			//From volume center, move vdelta.z + source_object_distance along current direction
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

			//zero out raysum and weight images
			cudaMemset(d_raysum_img, 0, proj_size);
			cudaMemset(d_weight_img, 0, proj_size);

			//Perform FP to get raysum_img and weight_imgs
			FP_splat_kernel<<<BPgrid, block>>>(d_rec_vol, d_raysum_img, d_weight_img);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "FP splat kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching FP splat kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//Create correction image, take relaxation factor lambda into account
			update_y_splat_kernel<<<FPgrid, block >>>(d_proj_data, d_raysum_img, d_weight_img, d_corr_img, d_yslack);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "correction image kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching correction kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//Perform backprojection
			update_x_splat_kernel<<<BPgrid, block>>> (d_rec_vol, d_corr_img, d_weight_img);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "BP splat kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching BP splat kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}
	}
}

//Proximal operator sirt splat
void sirt_splat_proximal_operator(int iter = 0)
{
	for (unsigned int iters = 0; iters < data_term_iters; iters++)
	{
		//Shuffle projection order
		if (current_tile == 0)
		{
			if (random_projection_order)
			{
				std::random_device rd;
				std::mt19937 g(rd());
				std::shuffle(projections.begin(), projections.end(), g);
			}
			pw_projections.push_back(projections);
		}

		//First, create the correction images for all projections
		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//Update current projection
			current_projection = pw_projections[iter][i];

			//Required in radians for cos and sin functions
			float angle = get_angle();
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//Update point in plane 'pip'
			//corresponds to center of projection image (sensor), in world coords
			//rotated accordingly to the current projection
			//It is simply moving source_object_distance from the origin along current direction
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

			//zero out raysum and weight images
			cudaMemset(d_raysum_img, 0.0f, proj_size);
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "SIRT FP memset error:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
			cudaMemset(d_weight_imgs + current_projection * pdim.x*pdim.y, 0.0f, proj_size);
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "SIRT FP memset error:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//for each y pixel, update_y_kernel
			FP_splat_kernel<<<BPgrid, block>>>(d_rec_vol, d_raysum_img, d_weight_imgs + current_projection * pdim.x*pdim.y);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "SIRT FP launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching SIRT FP:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//Create correction image, take relaxation factor lambda into account
			update_y_splat_kernel<<<BPgrid, block>>>(d_proj_data, d_raysum_img, d_weight_imgs + current_projection * pdim.x*pdim.y, d_corr_imgs + current_projection * pdim.x*pdim.y, d_yslacks + current_projection*pdim.x*pdim.y);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "correction image kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching correction kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}

		//Then, apply the corrections
		//The correction is the average of all computed correction images
		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//Update current projection
			current_projection = pw_projections[iter][i];

			//Required in radians for cos and sin functions
			float angle = starting_angle + angle_step * current_projection;
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//Update point in plane 'pip'
			//corresponds to center of projection image (sensor), in world coords
			//rotated accordingly to the current projection
			//It is simply moving source_object_distance from the origin along current direction
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

			//for each voxel, update_x_kernel, keep ray lengths and these things
			update_x_splat_kernel<<<BPgrid, block>>> (d_rec_vol, d_corr_imgs + current_projection*pdim.x*pdim.y, d_weight_imgs + current_projection*pdim.x*pdim.y);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "BP SIRT kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching BP SIRT:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}
	}
}

__global__ void update_y_kernel(float* yslack, const float* proj_data, const float* rec_vol, float* corr_img)
{
	//Row and column indexes 
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile*tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Projection image boundary check
	if ((row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y) && (col < pdim.x))
	{
		const unsigned int pixel_index = col + row*pdim.x;

		//Get ray origin at source plane
		float3 pos = get_ray_origin(col);

		//Entry and exit points of the ray in the volume
		float3 entry_pos = make_float3(0, 0, 0);
		float3 exit_pos = make_float3(0, 0, 0);

		//Variable to store ray-sum result
		float ray_sum = 0.0f;

		//Move along the ray
		//The number of steps / samples is M = ceil(2 * source_object_distance / sample_rate);
		for (int m = 0; m <= M; m++)
		{
			//If the current position is 'inside the volume'
			if ((pos.x <= vdim.x - 1) && (pos.x >= 0) &&
				//Y is always inside and never changes from ray_origin.y
				(pos.z <= vdim.z - 1) && (pos.z >= 0))
			{
				//Store first sampled point as entry point
				//TODO: Compute entry and exit points outside, once and exactly!
				if ((entry_pos.x == 0) && (entry_pos.y == 0) && (entry_pos.z == 0))
				{
					entry_pos = pos;
					entry_pos.x = entry_pos.x + 0.000000001; //To prevent funny things if the entry point was 0, 0, 0
				}

				//Update ray sum TODO convert pos to volume indices
				//TODO maybe convert outside and reconvert entry and exit once?
				ray_sum += sample_rate*interpol(rec_vol, pos, vdim);
					
				//Update last sampled position
				exit_pos = pos;
			}
			pos = pos + sample_rate*dir; //dir.y always 0
		}			

		////Get ray's length inside the volume with proximal add-ons
		float ray_length = 1.0 + lambda*length(exit_pos - entry_pos);

		//Correction = (lambda*(original - FP) - y)/ray_length, will be used updating X
		if ((ray_length > 1) && (proj_data[pixel_index + current_projection * pdim.y*pdim.x] > 0))
			corr_img[pixel_index] = (lambda*(proj_data[pixel_index + current_projection * pdim.y*pdim.x] - ray_sum) - yslack[pixel_index]) / ray_length;
		else
			corr_img[pixel_index] = 0; //If the ray length is 0, there is no correction.

		//Update y
		yslack[pixel_index] += chill_factor*corr_img[pixel_index];
	}
}

__global__ void update_x_kernel(float* rec_vol, const float* corr_img)
{
	//For the geometric operations
	//All the considered positions and directions must be consistent
	//e.g. all of them should be in the 'world coordinates'

	//Get slice voxel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile*tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((column < vdim.x) && (row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y))
	{
		const unsigned int voxel_index = column + (blockIdx.y*blockDim.y + threadIdx.y)*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Voxel position (origin at volume center)
		const float3 voxel_pos = make_float3(column - vdelta.x, row - vdelta.y, blockIdx.z - vdelta.z);

		//Get value t at which e + td is in the projection plane with point pip and normal n;
		//((e + t*d) - pip)*n = 0
		//(e-pip)*n = -td*n
		//t = (pip - e)*n / d*n
		//Given the parallel projection, the ray's direction and the normal to the projection plane are always the same
		//d = n
		//d is always (0, 0, 1) rotated. Should it be normalized?
		//t = (pip - e)*d / d*d
		//The norm of d is always one
		//t = (pip - e)*d
		//d.y is always zero
		//t = (pip.x - e.x)*d.x +  //t = (pip.z - e.z)*d.z
		float t = (pip.x - voxel_pos.x)*dir.x + (pip.z - voxel_pos.z)*dir.z;

		//Get the projection of the voxel in the projection plane
		float3 pvox = make_float3(voxel_pos.x + t * dir.x, voxel_pos.y, voxel_pos.z + t * dir.z);

		//rotate pvox back to original source plane, inverse rotation, cos(-x) = cos(x), sin(-t) = -sin(t)
		rotate_anticlockwise(pvox);

		//If the x, y position correspond to a correction pixel, apply correction
		if ((pvox.x <= pdelta.x) && (pvox.x >= -pdelta.x) &&
			(pvox.y <= pdelta.y) && (pvox.y >= -pdelta.y))
		{

			//Apply correction with bilinear interpolation
			rec_vol[voxel_index] += chill_factor*interpol2D(corr_img, make_float2(pvox.x + pdelta.x, pvox.y + pdelta.y), make_uint2(pdim.x, pdim.y));

			//Clip negative values
			//Positivity constraint
			if ((nonnegativity) && (rec_vol[voxel_index] < 0.0f))
				rec_vol[voxel_index] = 0.0f;
		}	
	}	
}

//Proximal operator of the data term
//Solved using SART according to TRex paper
//alpha = chill_factor
//p is the projection data
//u is an initial estimate of the volume 
//This code assumes that x and y have already been initialized
void sart_proximal_operator(int iter = 0)
{
	for (unsigned int iters = 0; iters < data_term_iters; iters++)
	{
		//Shuffle projection order
		if ((current_tile == 0))
		{
			if (random_projection_order)
			{
				std::random_device rd;
				std::mt19937 g(rd());
				std::shuffle(projections.begin(), projections.end(), g);
			}		
			pw_projections.push_back(projections);
		}

		//For each projection image
		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//Update current projection
			current_projection = pw_projections[iter][i];

			//Required in radians for cos and sin functions
			float angle = get_angle();
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//Update point in plane 'pip'
			//corresponds to center of projection image (sensor), in world coords
			//rotated accordingly to the current projection
			//It is simply moving source_object_distance from the origin along current direction
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

			//for each y pixel, update_y_kernel
			update_y_kernel<<<FPgrid, block>>>(d_yslack, d_proj_data, d_rec_vol, d_corr_img);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "Update y kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching update y kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//for each voxel, update_x_kernel, keep ray lengths and these things
			update_x_kernel<<<BPgrid, block>>>(d_rec_vol, d_corr_img);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "update x kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching update x kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}		
		}
	}	
}

//Proximal operator of the data term
//Solved using SIRT
//Similar to SART, but all the correction images are computed before updating the volume
//alpha = chill_factor
//p is the projection data
//u is an initial estimate of the volume
//This code assumes that x and y have already been initialized
void sirt_proximal_operator(int iter = 0)
{
	for (unsigned int iters = 0; iters < data_term_iters; iters++)
	{
		//Shuffle projection order
		if (current_tile == 0)
		{
			if (random_projection_order)
			{
				std::random_device rd;
				std::mt19937 g(rd());
				std::shuffle(projections.begin(), projections.end(), g);
			}
			pw_projections.push_back(projections);
		}

		//First, create the correction images for all projections
		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//Update current projection
			current_projection = pw_projections[iter][i];

			//Required in radians for cos and sin functions
			float angle = get_angle();
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//Update point in plane 'pip'
			//corresponds to center of projection image (sensor), in world coords
			//rotated accordingly to the current projection
			//It is simply moving source_object_distance from the origin along current direction
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

			//for each y pixel, update_y_kernel
			update_y_kernel<<<FPgrid, block>>>(d_yslacks + current_projection * pdim.x*pdim.y, d_proj_data, d_rec_vol, d_corr_imgs + current_projection * pdim.x*pdim.y);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "SIRT FP launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching SIRT FP:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}

		//Then, apply the corrections
		//The correction is the average of all computed correction images
		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//Update current projection
			current_projection = pw_projections[iter][i];

			//Required in radians for cos and sin functions
			float angle = starting_angle + angle_step * current_projection;
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//Update point in plane 'pip'
			//corresponds to center of projection image (sensor), in world coords
			//rotated accordingly to the current projection
			//It is simply moving source_object_distance from the origin along current direction
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

			//for each voxel, update_x_kernel, keep ray lengths and these things
			update_x_kernel <<<BPgrid, block>>>(d_rec_vol, d_corr_imgs + current_projection * pdim.x*pdim.y);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "BP SIRT kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching BP SIRT:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}
	}
}

__global__ void error_images_kernel(const float* proj_data, const float* rec_vol, float* corr_img)
{
	//Row and column indexes 
	unsigned int col = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = blockIdx.y*blockDim.y + threadIdx.y;

	//Projection image boundary check
	if ((row < pdim.y) && (col < pdim.x))
	{
		const unsigned int pixel_index = col + row * pdim.x;

		//Get ray origin at source plane
		float3 pos = get_ray_origin(col);

		//Entry and exit points of the ray in the volume
		float3 entry_pos = make_float3(0, 0, 0);
		float3 exit_pos = make_float3(0, 0, 0);

		//Variable to store ray-sum result
		float ray_sum = 0.0f;

		//Move along the ray
		//The number of steps / samples is M = ceil(2 * source_object_distance / sample_rate);
		for (int m = 0; m <= M; m++)
		{
			//If the current position is 'inside the volume'
			if ((pos.x <= vdim.x - 1) && (pos.x >= 0) &&
				//Y is always inside and never changes from ray_origin.y
				(pos.z <= vdim.z - 1) && (pos.z >= 0))
			{
				//Store first sampled point as entry point
				//TODO: Compute entry and exit points outside, once and exactly!
				if ((entry_pos.x == 0) && (entry_pos.y == 0) && (entry_pos.z == 0))
				{
					entry_pos = pos;
					entry_pos.x = entry_pos.x + 0.000000001; //To prevent funny things if the entry point was 0, 0, 0
				}

				//Update ray sum TODO convert pos to volume indices
				//TODO maybe convert outside and reconvert entry and exit once?
				ray_sum += sample_rate*interpol(rec_vol, pos, vdim);

				//Update last sampled position
				exit_pos = pos;
			}
			pos = pos + sample_rate * dir; //dir.y always 0
		}

		////Get ray's length inside the volume with proximal add-ons
		float ray_length = length(exit_pos - entry_pos);

		//Get absolute difference of original projection and reprojection
		//if (ray_length > 0)
		if ((ray_length > 0) && (proj_data[pixel_index + current_projection * pdim.y*pdim.x] > 0))
			corr_img[pixel_index] = abs(proj_data[pixel_index + current_projection * pdim.y*pdim.x] - ray_sum);
			//corr_img[pixel_index] = abs((proj_data[pixel_index + current_projection * pdim.y*pdim.x] - ray_sum) / ray_length);
		else
			corr_img[pixel_index] = 0; //If the ray length is 0 or the projection is 0 (masked), error = 0.
	}
}

__global__ void backproject_error_kernel(float* rec_vol, const float* corr_img)
{
	//For the geometric operations
	//All the considered positions and directions must be consistent
	//e.g. all of them should be in the 'world coordinates'

	//Get slice voxel index
	unsigned int column = blockIdx.x*blockDim.x + threadIdx.x;
	unsigned int row = current_tile * tile_size - (number_extra_rows / 2) + blockIdx.y*blockDim.y + threadIdx.y;

	//Check that the voxel is inside the volume
	//(check if it's not in an extra row/column)
	if ((column < vdim.x) && (row >= 0) && (row < pdim.y) && (blockIdx.y*blockDim.y + threadIdx.y < vdim.y))
	{
		const unsigned int voxel_index = column + (blockIdx.y*blockDim.y + threadIdx.y)*vdim.x + blockIdx.z*vdim.y*vdim.x;

		//Voxel position (origin at volume center)
		const float3 voxel_pos = make_float3(column - vdelta.x, row - vdelta.y, blockIdx.z - vdelta.z);

		//Get value t at which e + td is in the projection plane with point pip and normal n;
		//((e + t*d) - pip)*n = 0
		//(e-pip)*n = -td*n
		//t = (pip - e)*n / d*n
		//Given the parallel projection, the ray's direction and the normal to the projection plane are always the same
		//d = n
		//d is always (0, 0, 1) rotated. Should it be normalized?
		//t = (pip - e)*d / d*d
		//The norm of d is always one
		//t = (pip - e)*d
		//d.y is always zero
		//t = (pip.x - e.x)*d.x +  //t = (pip.z - e.z)*d.z
		float t = (pip.x - voxel_pos.x)*dir.x + (pip.z - voxel_pos.z)*dir.z;

		//Get the projection of the voxel in the projection plane
		float3 pvox = make_float3(voxel_pos.x + t * dir.x, voxel_pos.y, voxel_pos.z + t * dir.z);

		//rotate pvox back to original source plane, inverse rotation, cos(-x) = cos(x), sin(-t) = -sin(t)
		rotate_anticlockwise(pvox);

		//If the x, y position correspond to a correction pixel, apply correction
		if ((pvox.x <= pdelta.x) && (pvox.x >= -pdelta.x) &&
			(pvox.y <= pdelta.y) && (pvox.y >= -pdelta.y))
		{

			//Apply correction with bilinear interpolation
			rec_vol[voxel_index] += interpol2D(corr_img, make_float2(pvox.x + pdelta.x, pvox.y + pdelta.y), make_uint2(pdim.x, pdim.y));
		}
	}
}

//Get reprojection error of host_volume
//Measure error for each projection -> error tilt-series
//Reconstruct error tilt series into empty volume with SART
void compute_error_volume(CImgFloat &host_volume = h_rec_vol, string prename = "")
{
	printf("\nComputing error volume...\n");

	//Clear device memory
	clear_device();

	//Original dimensions
	vdim.x = host_volume.width();
	vdim.y = host_volume.height();
	vdim.z = host_volume.depth();
	printf("dim: %d, %d, %d\n", vdim.x, vdim.y, vdim.z);

	//Non-tiled settings
	tiled = false;
	number_of_tiles = 1;
	current_tile = 0;
	tile_size = 0;
	number_extra_rows = 0;

	//Update recon size
	recon_size = host_volume.size() * sizeof(float);

	// Allocate GPU original projection data 
	cudaStatus = cudaMalloc((void**)&d_proj_data, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU recon vol data
	cudaStatus = cudaMalloc((void**)&d_rec_vol, recon_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "rec. vol. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU corr_img
	cudaStatus = cudaMalloc((void**)&d_corr_img, proj_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "d_corr_img cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU error tilt series image
	cudaStatus = cudaMalloc((void**)&d_corr_imgs, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "corr. img. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Copy projections to GPU
	cudaStatus = cudaMemcpy(d_proj_data, h_proj_data._data, data_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Copy volume to GPU
	cudaStatus = cudaMemcpy(d_rec_vol, host_volume._data, recon_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Update kernel grids
	block = dim3(16, 8); //General block dimensions
	FPgrid = dim3(ceil((float)pdim.x / block.x), ceil((float)pdim.y / block.y)); //Grid for ray based FP computations
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), vdim.z); //Grid for ray-based BP, splat FP & BP, and per-voxel volume computations

	//Update vdelta
	vdelta = make_float3(0.5*(vdim.x - 1), 0.5*(vdim.y - 1), 0.5*(vdim.z - 1));

	//Create error tilt series in d_corr_imgs
	for (unsigned int i = 0; i < pdim.z; i++)
	{
		//Update current projection
		current_projection = i;

		//Required in radians for cos and sin functions
		float angle = get_angle();
		angle = radians(angle);

		//Update cosine and sine for point rotations
		cost = cos(angle);
		sint = sin(angle);

		//Update direction, simply is (0, 0, 1) rotated.
		//The norm is always one
		dir = make_float3(sint, 0, cost);

		//Update point in plane 'pip'
		//corresponds to center of projection image (sensor), in world coords
		//rotated accordingly to the current projection
		//It is simply moving source_object_distance from the origin along current direction
		pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));

		//create error image of current projection
		error_images_kernel<<<FPgrid, block >>>(d_proj_data, d_rec_vol, d_corr_imgs + i*pdim.x*pdim.y);

		// Check for any errors launching the kernel
		cudaStatus = cudaGetLastError();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Update y kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// cudaDeviceSynchronize waits for the kernel to finish, and returns
		// any errors encountered during the launch.
		cudaStatus = cudaDeviceSynchronize();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaDeviceSynchronize error after launching update y kernel:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	//Save error tilt series
	CImgFloat error_tilt_series(h_proj_data);
	cudaStatus = cudaMemcpy(error_tilt_series._data, d_corr_imgs, data_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "error tilt series cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	string fname = generate_filename();
	smrc("error_ts_" + prename + fname + ".mrc", error_tilt_series._data, pdim, 0);

	//Initialize d_rec_vol
	// Copy volume to GPU
	cudaMemset(d_rec_vol, 0, recon_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "d_rec_vol initialization failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//SART
	for (int data_iters = 0; data_iters < 10; data_iters++)
	{
		for (unsigned int i = 0; i < pdim.z; i++)
		{
			//printf("\rProjection %d/%d", i + 1, pdim.z);
			//Update current projection
			current_projection = i;

			//Angle required in radians for cos and sin functions
			float angle = get_angle();
			angle = radians(angle);

			//Update cosine and sine for point rotations
			cost = cos(angle);
			sint = sin(angle);

			//Update direction, simply is (0, 0, 1) rotated.
			//The norm is always one
			dir = make_float3(sint, 0, cost);

			//Update point in plane 'pip'
			//corresponds to center of projection image (sensor)
			//From volume center, (0,0,vdelta.z+source_object_distance)
			//rotated accordingly to the current projection
			pip = make_float3(sint*(vdelta.z + source_object_distance), 0, cost*(vdelta.z + source_object_distance));
			//pip = make_float3(sint*source_object_distance, 0, cost*source_object_distance);

			//Perform forward projection
			forward_projection_kernel <<<FPgrid, block >>>(d_corr_imgs, d_rec_vol, d_corr_img);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "tiled forward projection kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching tiled FP kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//Perform backprojection
			back_projection_kernel <<<BPgrid, block>>> (d_rec_vol, d_corr_img);

			// Check for any errors launching the kernel
			cudaStatus = cudaGetLastError();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "tiled back projection kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			// cudaDeviceSynchronize waits for the kernel to finish, and returns
			// any errors encountered during the launch.
			cudaStatus = cudaDeviceSynchronize();
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaDeviceSynchronize error after launching tiled BP kernel:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}
	}

	//Copy result and save
	CImgFloat error_volume(h_rec_vol);
	cudaStatus = cudaMemcpy(error_volume._data, d_rec_vol, recon_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "error volume cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	error_volume.save_analyze(string("err_" + prename + fname + ".hdr").c_str()); //Save final reconstruction stored in h_rec_vol 
}