#include"data_term_proximal_operator.h"
#include"tv_proximal_operator.h"
#include"huber_proximal_operator.h"

void primal_dual(int iterat = 0)
{
	//Primal-dual algorithm constants
	//gamma*tau*l2_norm(A)^2 < 1, theta in [0, 1]
	tau = 0.99/(gamma_pd*norm_A);

	//Theta in [0, 1]
	if (!((0 <= theta) && (theta <= 1)))
	{
		printf("Theta is not in [0, 1]!\n");
		error();
	}

	printf("\n***Starting reconstruction, iteration %d.***\n", iterat);
	printf("gamma: %f\ntau: %g\ntheta: %f\nsigma: %f\n", gamma_pd, tau, theta, sigma);

	//number_of_tiles = 1 for non tiled
	for (int j = 0; j < number_of_tiles; j++)
	{
		//Update current piece
		current_tile = j;

		// Copy initial yslack (all zeros) to GPU
		h_yslack = CImgFloat(pdim.x, pdim.y, 1, 1, 0.0f);
		cudaStatus = cudaMemcpy(d_yslack, h_yslack.data(), proj_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "initial yslack cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Initialize the volume x_0 = h_initial_volume
		cudaStatus = cudaMemset(d_rec_vol, 0.0f, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaMemcpy failed when copying back rec. vol!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//PRIMAL DUAL INITIALIZATION REQUIREMENT: u_0 = x_0
		cudaStatus = cudaMemcpy(d_y, d_rec_vol, recon_size, cudaMemcpyDeviceToDevice);
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

			// Copy rec_vol to rec_vol_old
			cudaStatus = cudaMemcpy(d_rec_vol_old, d_rec_vol, recon_size, cudaMemcpyDeviceToDevice);
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "rec. vol. cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//Update z = prox_conj_g(z + gamma*A*y)
			update_z_primal_dual();

			//Update x^(k+1) = prox_f(x^k - tau*A^T*z)
			update_x_primal_dual();
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

			//Update y = x^(k+1) + theta(x^(k+1) - x^k)
			update_y_primal_dual();

			double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
			printf("Time taken for last iteration: %f s.\n", elapsed_secs);

			//Save current d_rec_vol in corresponding intermediate result piece
			if (intermediate_volumes_list.size())
			{
				//Look for current iteration in intermediate results list
				auto it = std::find(intermediate_volumes_list.begin(), intermediate_volumes_list.end(), i + 1);

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
			// Copy rec_vol to rec_vol_old
			cudaStatus = cudaMemcpy(d_rec_vol_old, d_rec_vol, recon_size, cudaMemcpyDeviceToDevice);
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "rec. vol. cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}

			//Update z = prox_conj_g(z + gamma*A*y)
			update_z_primal_dual();

			//Update x^(k+1) = prox_f(x^k - tau*A^T*z)
			update_x_primal_dual();
			switch (data_term_operator)
			{
			case DATA_TERM_OPERATOR::SART:
				sart_proximal_operator(proximal_iters - 1);
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
	if (compute_error)
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

	if (gamma_correct != 1.0f)
	{
		//gamma_correction_result();
	}

	//Save
	if (result_filename == "")
		sv((fname + ".hdr").c_str());
	else
		sv((result_filename + ".hdr").c_str());
}