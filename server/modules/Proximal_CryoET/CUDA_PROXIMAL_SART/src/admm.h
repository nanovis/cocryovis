#include"data_term_proximal_operator.h"
#include"tv_proximal_operator.h"
#include"huber_proximal_operator.h"

void admm(int iterat = 0)
{
	printf("\n***Starting ADMM reconstruction, iteration %d.***\n", iterat);
	printf("sigma: %f\n", sigma);

	//number_of_tiles = 1 for non tiled
	for (int j = 0; j < number_of_tiles; j++)
	{
		//Update current piece
		current_tile = j;

		// Copy initial yslack (all zeros) to GPU
		cudaStatus = cudaMemset(d_yslack, 0, proj_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "initialization of yslack failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//ADMM requirements algorithm 4 TRex paper
		//Initialize the volume x_0 = fpmv
		cudaStatus = cudaMemset(d_rec_vol, 0.0f, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "d_rec_vol initialization failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Copy initial y admm (zeros) to GPU
		cudaStatus = cudaMemset(d_y, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Initialize z = 0
		cudaStatus = cudaMemset(d_z, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//for all t in 1...T
		for (unsigned int i = 0; i < proximal_iters; i++)
		{
			clock_t start_time = clock();

			//Check convergence every 5 iterations
			if (check_convergence && (current_tile == 0) && ((i + 1) % 5 == 0))
			{
				float current_tile_norm = volume_normal(d_rec_vol);

				//If converged
				if (abs(tile_norm - current_tile_norm) < tile_norm / 1000)
				{
					//Set new iteration number and go to next tile
					printf("First tile converged.\n");
					printf("Norm: %f, difference: %f\n", current_tile_norm, abs(tile_norm - current_tile_norm));
					proximal_iters = i;
					break;
				}
				else
				{
					printf("Norm of current tile: %f\n", current_tile_norm);
					tile_norm = current_tile_norm;
				}
			}

			printf("Tile %d, iteration %d/%d.\n", current_tile, i + 1, proximal_iters);

			//Update x before applying the P.O.
			//x = prox(z - y)
			substract_volumes(d_z, d_y, d_rec_vol);
			switch (data_term_operator)
			{
			case DATA_TERM_OPERATOR::SART:
				sart_proximal_operator(i);
				break;
			case DATA_TERM_OPERATOR::SART_SPLAT:
				sart_splat_proximal_operator(i);
				break;
			case DATA_TERM_OPERATOR::SIRT:
				sirt_proximal_operator(i);
				break;
			case DATA_TERM_OPERATOR::SIRT_SPLAT:
				sirt_splat_proximal_operator(i);
				break;
			}

			//Update z with proximal operator TODO, CHECK TREX 5
			//z = denoiser_prox(x + u)
			//First update z, then apply NLM (operator)
			add_volumes(d_rec_vol, d_y, d_z);
			switch (denoise_operator)
			{			
			case DENOISE_OPERATOR::NLM2D:
				update_z_admm_nlm2d();
				break;
			case DENOISE_OPERATOR::NLM3D:
				update_z_admm_nlm3d();
				break;
			}					

			//update y = y + x - z
			update_y_admm();

			double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
			printf("\nTime taken for last iteration: %f s.\n", elapsed_secs);

			//Save current d_rec_vol in corresponding intermediate result piece
			if (intermediate_volumes_list.size())
			{
				//Look for current iteration in intermediate results list
				auto it = std::find(intermediate_volumes_list.begin(), intermediate_volumes_list.end(), i+1);

				//If current iteration is in the intermediate result list
				if (it != intermediate_volumes_list.end())
				{					
					int index = it - intermediate_volumes_list.begin();
					if (tiled)
					{
						copy_piece_to_host(h_intermediate_volumes[index]);
					}
					else
					{
						if (iterat != 0)
							save_hdr("lin_admm_" + to_string(iterat) + "_" + to_string(i + 1));
						else
							save_hdr("lin_admm_" + to_string(i + 1));
					}
				}				
			}
		}

		if (data_term_end)
		{
			substract_volumes_kernel<<<BPgrid, block >>>(d_z, d_y, d_rec_vol);
			switch (data_term_operator)
			{
			case DATA_TERM_OPERATOR::SART:
				sart_proximal_operator(proximal_iters-1);
				break;
			case DATA_TERM_OPERATOR::SART_SPLAT:
				sart_splat_proximal_operator(proximal_iters - 1);
				break;
			case DATA_TERM_OPERATOR::SIRT:
				sirt_proximal_operator(proximal_iters - 1);
				break;
			}
		}

		//Copies piece back to h_rec_vol, if tiled
		copy_piece_to_host();
	}	
	
	//Generate file name and save
	string fname = generate_filename();
	
	//Compute error volume
	if(compute_error)
		compute_error_volume();	

	//Save intermediate volumes with errors
	for (int i = 0; i < intermediate_volumes_list.size(); i++)
	{
		//Compute error volume
		if (compute_error)
			compute_error_volume(h_intermediate_volumes[i], "iter_" + to_string(intermediate_volumes_list[i]));

		string intermediate_fname = "iter_" + to_string(intermediate_volumes_list[i]) + fname + ".hdr";

		//Crop and gamma correction in the end
		if (crop)
		{
			crop_result(h_intermediate_volumes[i]);
		}

		if (!is_data_linearized && delinearize_result)
		{
			delinearize_result_(h_intermediate_volumes[i]);
		}

		h_intermediate_volumes[i].save_analyze(intermediate_fname.c_str());
	}	

	//Crop
	if (crop)
	{
		crop_result();
	}

	if (!is_data_linearized && delinearize_result)
	{
		delinearize_result_();
	}

	//Save
	if (result_filename == "")
		sv((fname + ".hdr").c_str());
	else
		sv((result_filename + ".hdr").c_str());
}