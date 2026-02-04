#include "proximal_iteration.h"
#include "linearized_admm.h"
#include "admm.h"
#include "primal_dual.h"
#include "NLM.h"

int main(int argc, char **argv)
{	
	//Parse the input command to set the experiment
	//If no command is set, the experiment is set to default values
	parse_commands(argc, argv);	

	switch (alg)
	{
	case 1:
		algo = ALGORITHM::PROXI_ITER;
		printf("Starting proximal iteration\n");
		break;
	case 2:
		printf("Starting linearized admm\n");
		algo = ALGORITHM::L_ADMM;
		break;
	case 3:
		algo = ALGORITHM::PRIMAL_DUAL;
		printf("Starting primal-dual\n");
		break;
	case 4:
		algo = ALGORITHM::POWER_METHOD;
		printf("Starting power method\n");
		break;
	case 5:
		hdr2mrc(filename.c_str());
		clear_device();
		exit(0);
		break;
	case 6:
		break;
	case 7:
		crop_vol(filename.c_str());
		_pause();
		clear_device();
		exit(0);
		break;
	case 8:
		mrc2hdr(filename.c_str());
		clear_device();
		exit(0);
		break;
	case 9:
		slice_profile("ts_1_iter_26.hdr");
		_pause();
		clear_device();
		exit(0);
		break;
	case 10:
		linearize_projections();
		clear_device();
		exit(0);
		break;
	case 11:
		delinearize_volume();
		clear_device();
		exit(0);
		break;
	case 12:
		break;
	case 13:
		histogram_equalization();
		clear_device();
		exit(0);
		break;
	case 14:
		mask_projections(filename);
		clear_device();
		exit(0);
		break;
	case 15:
		volume_to_images(number_of_tiles);
		break;
	case 16:
		algo = ALGORITHM::ADMM;
		printf("Starting ADMM\n");
		break;
	case 17:
		volume_histogram();
		clear_device();
		exit(0);
	case 18:
		break;
	case 19:
		normalize_volume_zero_one(gamma_pd);
		clear_device();
		exit(0);
	case 20:
		algo = ALGORITHM::PROXI_ITER;
		printf("Starting SART\n");
		break;
	case 21:
		algo = ALGORITHM::PROXI_ITER;
		printf("Starting SIRT\n");
		break;
	case 22:
		algo = ALGORITHM::PROXI_ITER;
		printf("Starting SART SPLAT\n");
		break;
	case 23:
		algo = ALGORITHM::PROXI_ITER;
		printf("Starting SIRT SPLAT\n");
		break;
	default:
		error();
		break;
	}

	////Load the kernel lookup into h_kernel_lookup
	if ((data_term_operator == DATA_TERM_OPERATOR::SART_SPLAT) || (data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT))
		load_kernel_lookup();
	
	mrcParser.load_original(filename);

	//Get the projection sizes and print
	pdim.x = mrcParser.dimensions(0);
	pdim.y = mrcParser.dimensions(1);
	pdim.z = mrcParser.dimensions(2);		
	printf("%d projections of size: %d, %d loaded succesfully.\n", pdim.z, pdim.x, pdim.y);

	//Check if list of angles was provided 
	if (angles_list_filename == "")
	{
		//Verify initial angle and angle step
		if ((starting_angle == 0.0f) && (angle_step == 0.0f))
		{
			printf("Projections starting angle and angle step were not provided.\n");
			if (pdim.z == 41)
			{
				starting_angle = -60.0;
				angle_step = 3.0;
				projections = { 20, 21, 19, 22, 18, 23, 17, 24, 16, 25, 15, 26, 14, 27, 13, 28, 12, 29, 11, 30, 10, 31, 9, 32, 8, 33, 7, 34, 6, 35, 5, 36, 4, 37, 3, 38, 2, 39, 1, 40, 0 };
			}
			else if (pdim.z == 120)
			{
				starting_angle = 0.0;
				angle_step = 3.0;

				for (int i = 0; i < pdim.z; i++)
				{
					projections.push_back(i);
				}
			}
			else if (pdim.z == 61)
			{
				starting_angle = -180.0;
				angle_step = 3.0;

				for (int i = 0; i <= 30; i++)
				{
					if (i == 0)
						projections.push_back(30);
					else
					{
						projections.push_back(30 - i);
						projections.push_back(30 + i);
					}
				}
			}
			else if (pdim.z == 121)
			{
				starting_angle = -60.0;
				angle_step = 1.0;

				for (int i = 0; i <= 60; i++)
				{
					if (i == 0)
						projections.push_back(60);
					else
					{
						projections.push_back(60 - i);
						projections.push_back(60 + i);
					}
				}
			}
			else
			{
				printf("Please provide initial angle and angle step size\n");
				clear_device();
				exit(0);
			}

			printf("Assumed: Starting angle %f, angle step %f\n", starting_angle, angle_step);
		}
		else
		{
			{
				if (pdim.z == 41)
				{
					projections = { 20, 21, 19, 22, 18, 23, 17, 24, 16, 25, 15, 26, 14, 27, 13, 28, 12, 29, 11, 30, 10, 31, 9, 32, 8, 33, 7, 34, 6, 35, 5, 36, 4, 37, 3, 38, 2, 39, 1, 40, 0 };
				}
				else if (pdim.z == 61)
				{
					for (int i = 0; i <= 30; i++)
					{
						if (i == 0)
							projections.push_back(30);
						else
						{
							projections.push_back(30 - i);
							projections.push_back(30 + i);
						}
					}
				}
				else
				{
					for (int i = 0; i < pdim.z; i++)
					{
						projections.push_back(i);
					}

					std::random_device rd;
					std::mt19937 g(rd());
					std::shuffle(projections.begin(), projections.end(), g);
				}
			}
		}
	}
	else
	{
		//Read angle list file
		read_tlt();

		//Create initial random projections list
		for (int i = 0; i < pdim.z; i++)
		{
			projections.push_back(i);
		}
		std::random_device rd;
		std::mt19937 g(rd());
		std::shuffle(projections.begin(), projections.end(), g);
	}


	printf("Projection order:\n");
	for (int i = 0; i < pdim.z - 1; i++)
		printf("%d, ", projections[i]);
	printf("%d\n", projections[pdim.z-1]);	

	//Create CImgFloat to hold original projections on host
	h_proj_data = CImgFloat(pdim.x, pdim.y, pdim.z, 1, 0.0f);
    h_proj_data._data = mrcParser.getData();

	//If you need to flip vertically
	//Might be useful when saving hdr format
	//h_proj_data.mirror('y');
	
	//tiled or not
	if (tiled && (number_of_tiles != 1))
	{				
		//Check that # extra rows is even
		if (number_extra_rows % 2 != 0)
		{
			printf("Number of extra rows must be even!\n");

		}

		//Check that the image/volume y-axis can be divided by selected number of pieces
		if (pdim.y % number_of_tiles == 0)
		{
			tile_size = pdim.y / number_of_tiles;
			printf("tiled, %d pieces of size %d, %d extra rows\n", number_of_tiles, tile_size, number_extra_rows);
		}
		else
		{
			printf("y-axis length is not divisible by selected number of pieces!\n");
			error();
		}		
	}
	else
	{
		//Non-tiled settings
		tiled = false;
		number_of_tiles = 1;
		current_tile = 0;
		tile_size = pdim.y;
		number_extra_rows = 0;
	}

	//Reconstructed volume dimensions.
	//There is padding in horizontal axis, all the rays must be 'whole' for the most extreme angles.
	//The padding depends on volume depth -> set depth first
	if (tiled)
	{
		vdim.z = volume_depth;
		vdim.x = ceil(2 * vdim.z / tan(radians(30))) + abs(-1.0f*(float)pdim.x*sin(radians(30)) + (cos(radians(30)) / sin(radians(30)))*((float)vdim.z - (float)pdim.x*cos(radians(30))));
		vdim.y = tile_size + number_extra_rows; //Additional rows above and below for interpolation
	}	
	else
	{
		vdim.z = volume_depth;
		vdim.x = ceil(2 * vdim.z / tan(radians(30))) + abs(-1.0f*(float)pdim.x*sin(radians(30)) + (cos(radians(30)) / sin(radians(30)))*((float)vdim.z - (float)pdim.x*cos(radians(30))));
		vdim.y = pdim.y; //Additional rows above and below for interpolation
	}

	printf("Rec. vol. size: %d x %d x %d\n", vdim.x, vdim.y, vdim.z);

	padding = (vdim.x - pdim.x) / 2;
	printf("padding: %d\n", padding);

	//vdelta is the offset between the center of the volume an d the 0, 0, 0, voxel
	//pdelta is similar but for planes
	//ATTENTION!! In general, pdelta.x and vdelta.x are not the same!
	vdelta = make_float3(0.5*(vdim.x - 1), 0.5*(pdim.y - 1), 0.5*(vdim.z - 1));
	pdelta = make_float2(0.5*(pdim.x - 1), 0.5*(pdim.y - 1));
	printf("vdelta: %f, %f, %f\n", vdelta.x, vdelta.y, vdelta.z);
	printf("pdelta: %f, %f\n", pdelta.x, pdelta.y);

	//To do per_slice min, max, etc...
	h_per_slice = new float[vdim.z];

	//Distance between origin and source plane
	//5% Bigger than volume's xz diagonal
	source_object_distance = 1.05*(sqrt((float)(vdim.x*vdim.x) + (float)(vdim.z*vdim.z)));
	printf("sod: %f\n", source_object_distance);

	//Number of steps in the ray in FP
	M = ceil((2.0*(source_object_distance + vdelta.z)) / sample_rate);
	printf("M: %d\n", M);

	//Used to save intermediate pieces results
	if(tiled)
		h_piece = CImgFloat(vdim.x, tile_size, vdim.z, 1, 0.0f);
		
	printf("norm(A)^2: %f\n\n", norm_A);	

	//Get the sizes in bytes
	data_size = h_proj_data.size() * sizeof(float); //Original projection data size
	printf("Data size: %f MB\n", (float)data_size/1000000);
	recon_size = vdim.x*vdim.y*vdim.z * sizeof(float); //Reconstructed volume size
	printf("Recon size: %f GB\n", (float)recon_size / 1000000000);
	proj_size = pdim.x*pdim.y* sizeof(float); //Size of projection image, correction image, ray length image
	printf("Proj size: %f MB\n", (float)proj_size/1000000);

	block = dim3(16, 8); //General block dimensions
	FPgrid = dim3(ceil((float)pdim.x / block.x), ceil((float)vdim.y / block.y)); //Grid for ray based FP computations
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), vdim.z); //Grid for ray-based BP, splat FP & BP, and per-voxel volume computations

	//Allocate memory and load projections
	allocate_memory();

	//Linearize projection data, if needed
	if(!is_data_linearized)
		linearize_projections();
	
	//Create CImgFloat for host reconstruction data
	//This can be used to save volumes or store final result
	h_rec_vol = CImgFloat(vdim.x, pdim.y, vdim.z, 1, 0.0f);

	//Host volumes to store intermediate results
	for (int i = 0; i < intermediate_volumes_list.size(); i++)
	{
		h_intermediate_volumes.push_back(CImgFloat(h_rec_vol));
	}

	//SART AND SIRT
	if ((alg >= 20) && (alg <= 23))
	{
		if (alg == 21)
			sirt();
		else if (alg == 22)
			sart_splat();
		else if (alg == 23)
			sirt_splat();
		else
			sart();

		string fname = generate_filename();

		//Crop
		if (crop)
		{
			crop_result();
		}

		if (delinearize_result)
		{
			delinearize_result_();
		}

		//Save
		if (result_filename == "")
			sv((fname + ".hdr").c_str());
		else
			sv((result_filename + ".hdr").c_str());

	}
	else if ((algo == ALGORITHM::PROXI_ITER) && (alg == 1))
		proximal_iteration();
	else if (algo == ALGORITHM::PRIMAL_DUAL)
		primal_dual();
	else if ((algo == ALGORITHM::L_ADMM) && (alg == 2))
	{
		switch (ladmm_variant)
		{
		case 0:
			printf("LADMM (results)\n");
			linearized_admm(); //The one with results
			break;
		case 1:
			printf("LADMM (results, TV+NLM)\n");
			linearized_admm_1(); //Similar but TV+NLM in the end
			break;
		case 2:
			printf("LADMM (results, NLM+TV)\n");
			linearized_admm_1_1(); //Similar but NLM+TV in the end
			break;
		case 3:
			printf("LADMM TV -> TV+NLM");
			linearized_admm_2(); //Corrected, swap TV operator for TV+NLM operator in the end
			break;
		}
	}		
	else if (algo == ALGORITHM::ADMM)
		admm();
	else if (algo == ALGORITHM::POWER_METHOD)
	{
		//Initialize d_rec_vol to volume of ones
		h_rec_vol = CImgFloat(vdim.x, vdim.y, vdim.z, 1, 1.0);
		cudaStatus = cudaMemcpy(d_rec_vol, h_rec_vol.data(), recon_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaMemcpy failed when copying back rec. vol!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		printf("\nA's l2 norm: %g", power_method());	
	}

	printf("\nReconstruction finished.\n");

	//Wait for any saving process
	if (save_thread.joinable())
		save_thread.join();

	clear_device();
	cudaStatus = cudaDeviceReset();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceReset failed:");
	}
	return 0;
}