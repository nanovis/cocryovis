#include"data_term_proximal_operator.h"
#include"tv_proximal_operator.h"
#include"huber_proximal_operator.h"

void linearized_admm(int iterat = 0)
{
	mu = 0.99f/(ro*norm_A); // 1/(ro*norm(K)^2)

	//mu > 0
	if (!((mu > 0) && (mu*ro*norm_A <= 1)))
	{
		printf("Error in mu/rho LADMM parameters!\n");
		error();
	}

	printf("\n***Starting LADMM reconstruction, iteration %d.***\n", iterat);
	printf("ro: %f\nmu: %g\nsigma: %f\n", ro, mu, sigma);

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

		//LADMM requirements algorithm 4 TRex paper
		//Initialize the volume x_0 = 0
		cudaStatus = cudaMemset(d_rec_vol, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing d_rec_vol failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Copy initial y admm (zeros) to GPU
		h_y_admm = CImgFloat(vdim.x, vdim.y, vdim.z, 3, 0.0f);
		cudaStatus = cudaMemcpy(d_y, h_y_admm._data, 3 * recon_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Initialize z = K*x = volume's gradient
		volume_gradient(d_rec_vol, d_z);

		//for all t in 1...T
		for (unsigned int i = 0; i < proximal_iters; i++)
		{
			clock_t start_time = clock();

			//Check convergence every 5 iterations
			if (check_convergence && (current_tile == 0) && ((i+1)%5 == 0))
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
			//x = x + mu*ro *trans(K)*(z - y -K*x)
			update_x_ladmm();
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
			if (nlm_finish_2d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, NLM.\n", i + 1);
				update_z_ladmm_nlm2d();
			}
			else if (nlm_finish_3d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, 3DNLM.\n", i + 1);
				update_z_ladmm_nlm3d();
			}
			else if (denoise_operator == DENOISE_OPERATOR::HTV)
				update_z_ladmm_htv();
			else
				update_z_ladmm_tv();

			//update y following line 5 algorithm 4 TRex paper
			//y = y + Kx - z
			update_y_ladmm();

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
			update_x_ladmm();
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


//Leave TV on, , TV->NLM
void linearized_admm_1(int iterat = 0)
{
	mu = 0.99f / (ro*norm_A); // 1/(ro*norm(K)^2)

	//mu > 0
	if (!((mu > 0) && (mu*ro*norm_A <= 1)))
	{
		printf("Error in mu/rho LADMM parameters!\n");
		error();
	}

	printf("\n***Starting LADMM reconstruction, iteration %d.***\n", iterat);
	printf("ro: %f\nmu: %g\nsigma: %f\n", ro, mu, sigma);

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

		//LADMM requirements algorithm 4 TRex paper
		//Initialize the volume x_0 = 0
		cudaStatus = cudaMemset(d_rec_vol, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing d_rec_vol failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Copy initial y admm (zeros) to GPU
		h_y_admm = CImgFloat(vdim.x, vdim.y, vdim.z, 3, 0.0f);
		cudaStatus = cudaMemcpy(d_y, h_y_admm._data, 3 * recon_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Initialize z = K*x = volume's gradient
		volume_gradient(d_rec_vol, d_z);

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
			//x = x + mu*ro *trans(K)*(z - y -K*x)
			update_x_ladmm();
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
			if (denoise_operator == DENOISE_OPERATOR::HTV)
				update_z_ladmm_htv();
			else
				update_z_ladmm_tv();

			//NLM last iters
			if (nlm_finish_2d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, NLM.\n", i + 1);
				update_z_ladmm_nlm2d();
			}
			else if (nlm_finish_3d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, 3DNLM.\n", i + 1);
				update_z_ladmm_nlm3d();
			}

			//update y following line 5 algorithm 4 TRex paper
			//y = y + Kx - z
			update_y_ladmm();

			double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
			printf("\nTime taken for last iteration: %f s.\n", elapsed_secs);

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
			update_x_ladmm();
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


//Leave TV on, , NLM->TV
void linearized_admm_1_1(int iterat = 0)
{
	mu = 0.99f / (ro*norm_A); // 1/(ro*norm(K)^2)

	//mu > 0
	if (!((mu > 0) && (mu*ro*norm_A <= 1)))
	{
		printf("Error in mu/rho LADMM parameters!\n");
		error();
	}

	printf("\n***Starting LADMM reconstruction, iteration %d.***\n", iterat);
	printf("ro: %f\nmu: %g\nsigma: %f\n", ro, mu, sigma);

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

		//LADMM requirements algorithm 4 TRex paper
		//Initialize the volume x_0 = 0
		cudaStatus = cudaMemset(d_rec_vol, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing d_rec_vol failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Copy initial y admm (zeros) to GPU
		h_y_admm = CImgFloat(vdim.x, vdim.y, vdim.z, 3, 0.0f);
		cudaStatus = cudaMemcpy(d_y, h_y_admm._data, 3 * recon_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Initialize z = K*x = volume's gradient
		volume_gradient(d_rec_vol, d_z);

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
			//x = x + mu*ro *trans(K)*(z - y -K*x)
			update_x_ladmm();
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

			//NLM last iters
			if (nlm_finish_2d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, NLM.\n", i + 1);
				update_z_ladmm_nlm2d();
			}
			else if (nlm_finish_3d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, 3DNLM.\n", i + 1);
				update_z_ladmm_nlm3d();
			}

			//Update z with proximal operator TODO, CHECK TREX 5			
			if (denoise_operator == DENOISE_OPERATOR::HTV)
				update_z_ladmm_htv();
			else
				update_z_ladmm_tv();

			//update y following line 5 algorithm 4 TRex paper
			//y = y + Kx - z
			update_y_ladmm();

			double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
			printf("\nTime taken for last iteration: %f s.\n", elapsed_secs);

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
			update_x_ladmm();
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


//LADMM requirements algorithm 4 TRex paper
//Corrected LADMM
//For first TV iterations, K = Ktv, only tv operator
//For last TV+NLM operators, K = [Ktv;Knlm], Ktv is forward difference, Knlm is the identity
void linearized_admm_2(int iterat = 0)
{
	mu = 0.99f/(ro*norm_A); // 1/(ro*norm(K)^2)

	//mu > 0
	if (!((mu > 0) && (mu*ro*norm_A <= 1)))
	{
		printf("Error in mu/rho LADMM parameters!\n");
		error();
	}

	printf("\n***Starting LADMM reconstruction, iteration %d.***\n", iterat);
	printf("ro: %f\nmu: %g\nsigma: %f\n", ro, mu, sigma);

	//number_of_tiles = 1 for non tiled
	for (int j = 0; j < number_of_tiles; j++)
	{
		//Update current piece
		current_tile = j;

		// Copy initial yslack (all zeros) to GPU
		cudaStatus = cudaMemset(d_yslack, 0, proj_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "yslack init failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		
		//Initialize the volume x_0 = 0
		cudaStatus = cudaMemset(d_rec_vol, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Initializing d_rec_vol failed!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Copy initial y admm (zeros) to GPU
		cudaStatus = cudaMemset(d_y, 0, 3*recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y_tv admm init failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		cudaStatus = cudaMemset(d_y_nlm, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y_nlm admm init failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Initialize Ztv = Ktv*x = 0
		//Znlm = I*x = 0
		cudaStatus = cudaMemset(d_z, 0, 3*recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "z_tv admm init failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		cudaStatus = cudaMemset(d_z_nlm, 0, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "z_nlm admm init failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//for all t in 1...T
		for (unsigned int i = 0; i < proximal_iters; i++)
		{
			clock_t start_time = clock();
			printf("Tile %d, iteration %d/%d.\n", current_tile, i + 1, proximal_iters);

			//Update x before applying the P.O.
			//x = x - (mu/ro)*trans(K)*(Kx - z + y)
			if ((nlm_finish_2d || nlm_finish_3d) && (i >= proximal_iters - nlm_last_iters))
			{
				//TV + NLM UPDATE
				update_x_ladmm_2();
			}
			else 
			{
				//TV only update
				update_x_ladmm();				
			}
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

			//Update Znlm only in last iters
			//Znlm = NLM(x + Ynlm)
			//1. Znlm = Xnlm + Ynlm
			//2. NLM(Znlm)
			if (nlm_finish_2d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, NLM.\n", i + 1);
				add_volumes(d_rec_vol, d_y_nlm, d_z_nlm);
				update_z_ladmm_nlm2d_2();
			}
			else if (nlm_finish_3d && (i >= proximal_iters - nlm_last_iters))
			{
				printf("Iter %d, 3DNLM.\n", i + 1);
				add_volumes(d_rec_vol, d_y_nlm, d_z_nlm);
				update_z_ladmm_nlm3d_2();
			}

			//Update Ztv always
			if (denoise_operator == DENOISE_OPERATOR::HTV)
				update_z_ladmm_htv();
			else
				update_z_ladmm_tv();

			//y = y + Kx - z
			//Update Ynlm only in last iters
			if ((nlm_finish_2d || nlm_finish_3d) && (i >= proximal_iters - nlm_last_iters))
			{
				//Ynlm = Ynlm + x - Znlm
				update_y_ladmm_2();
			}

			//Update Ytv always
			//Ytv = Ytv + Ktv*x - Ztv
			update_y_ladmm();

			double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
			printf("\nTime taken for last iteration: %f s.\n", elapsed_secs);

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
			update_x_ladmm_2();
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

	//Save
	if (result_filename == "")
		sv((fname + ".hdr").c_str());
	else
		sv((result_filename + ".hdr").c_str());

}
