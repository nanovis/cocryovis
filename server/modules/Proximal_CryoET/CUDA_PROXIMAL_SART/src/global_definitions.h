#pragma once

#include "kernel_functions.h"
#include <thread>
#include <fstream>
#include <random>
#include <vector>
#include <iostream>
#include <fstream>
#include <sstream>

//MRCParser given By Ondrej
#include "MRCParser.cpp"

//CImg
#include "CImg-2.6.1/CImg.h"

#define PI 3.14159265358979323846
#define cimg_use_tif

bool crop = 1;
bool is_data_linearized = 0;
bool delinearize_result = 1;
bool compute_error = 0;
bool check_convergence = false;
bool normalize_kernel = false;

float tile_norm = 0;

using std::string;
using std::thread;
using std::to_string;
using std::find;
using std::stoi;

typedef cimg_library::CImg<float> CImgFloat;

unsigned int data_term_iters; //Number of sart iterations for data term proximal operator
unsigned int proximal_iters; //Number of iterations of selected proximal algorithm
unsigned int alg; //For algorithm selection
unsigned int ladmm_variant = 0;

string filename;
string result_filename = "";
string splat_kernel = "bilinear.txt";
string angles_list_filename = ""; //To store filename of list of angles like IMOD's .tlt
string volume_to_project = "";

//Variable to store cuda error status
cudaError_t cudaStatus;

//Host data
CImgFloat h_rec_vol, h_proj_data, h_yslack, h_y_admm, h_piece, h_error_vol;
float* h_per_slice;

//To save intermediate results
vector<CImgFloat> h_intermediate_volumes;
vector<unsigned int> intermediate_volumes_list = {}; //List of iterations we want to save intermediate results

//Device data
float* d_proj_data;    //Original projection data   
float* d_rec_vol;     //Reconstructed volume
float* d_rec_vol_old; //Reconstructed volume from previous iteration, for primal-dual
float* d_corr_img;    //Correction image for backprojection
float* d_corr_imgs; //Array of correction images for SIRT
float* d_yslack; //Slack variable for data term proximal operator
float* d_yslacks; //Slack variables for SIRT data term proximal operator
float* d_y; //Slack variable y for LADMM/primal-dual (TV)
float* d_y_nlm; //Slack y for LADMM/PD (NLM)
float* d_z; //Slack variable z for LADMM/primal-dual (TV)
float* d_z_nlm; //Slack variable z for LADMM/primal-dual (NLM)
float* d_raysum_img; //Ray sum image storing weighted sums for each ray in splat FP
float* d_weight_img; //Weight image storing per ray sum of weights in sart splat FP.
float* d_weight_imgs; //Weight image storing per ray sum of weights in sirt splat FP.
float* d_per_slice; //To use with max, min, etc. kernels

//Data sizes
size_t data_size, recon_size, proj_size;

//dim3 for blocks and grids
//FPgrid will be pdim.y for not tiled and slab_size+n_extra for tiled
dim3 block, FPgrid, BPgrid;

//To read MRC files, by Ondrej
MRCParser mrcParser;

//Thread to save volumes
thread save_thread;

std::vector<int> projections;
std::vector<float> angles_list;
std::vector<std::vector<int>> pw_projections;

//Algorithm options
enum ALGORITHM
{
	PROXI_ITER,
	L_ADMM,
	PRIMAL_DUAL,
	POWER_METHOD,
	ADMM
};

ALGORITHM algo;

//Data term proximal operator options
//SART, SIRT
enum DATA_TERM_OPERATOR
{
	SART,	
	SART_SPLAT,
	SIRT,
	SIRT_SPLAT
};

enum DENOISE_OPERATOR
{
	TV,
	HTV,
	NLM2D,
	NLM3D
};

DATA_TERM_OPERATOR data_term_operator = DATA_TERM_OPERATOR::SART;
DENOISE_OPERATOR denoise_operator = DENOISE_OPERATOR::TV;

float norm_A = 11.99f; //square of l2 norm of A

float starting_angle = 0.0f;
float angle_step = 0.0f;

bool random_projection_order = true; //Random projection order or not

//Free all device data objects
void clear_device()
{
	if (save_thread.joinable())
		save_thread.join();

	cudaFree(d_proj_data);
	cudaFree(d_rec_vol);
	cudaFree(d_rec_vol_old);
	cudaFree(d_corr_img);
	cudaFree(d_corr_imgs);	
	cudaFree(d_yslack);
	cudaFree(d_yslacks);
	cudaFree(d_y);
	cudaFree(d_z);
	cudaFree(d_raysum_img);
	cudaFree(d_weight_img);
	cudaFree(d_per_slice);

	//Clear last error is an object has already been cleared
	cudaStatus = cudaGetLastError();
}


//In case of cuda error, free the device objects, reset device and exit
void error()
{
	clear_device();

	cudaStatus = cudaDeviceReset();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceReset failed:");
	}

	printf("Program will exit\n");
	// _pause(); // Removed so it fails properly when lauched as a subprocess.
	exit(1);
}

//Computes the discrete gradient of the volume rec_vol
//And stores it in vol_grad
//Assumes 3D volume
void volume_gradient(const float* rec_vol, float* vol_grad)
{
	volume_gradient_kernel<<<BPgrid, block>>>(rec_vol, vol_grad);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "gradient kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching gradient kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

// Computes the discrete divergence of a gradient
//And stores it in rec_vol
//Assumes 4D gradient
void volume_divergence(const float* vol_grad, float* vol_div)
{
	volume_divergence_kernel<<<BPgrid, block>>>(vol_grad, vol_div);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "divergence kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching divergence kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//volume = scalar*volume
void scale_volume(float* d_rec_vol, float scalar)
{
	scale_volume_kernel<<<BPgrid, block>>>(d_rec_vol, scalar);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "scale_volume kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching scale_volume kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//Returns the l2norm of a volume
//l2norm = sqrt(sum of elements^2)
float volume_normal(const float* d_rec_vol)
{	
	volume_normal_kernel<<<1, vdim.z>>>(d_rec_vol, d_per_slice);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume_normal kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching volume_normal kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result
	cudaStatus = cudaMemcpy(h_per_slice, d_per_slice, vdim.z*sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error copying to h_per_slice:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	float sum=0;
	for (int i = 0; i < vdim.z; i++)
	{
		sum += h_per_slice[i];
	}

	return sqrt(sum);
}


//Dot product of volumes
//Sum of element-wise multiplication
float volume_dot(const float* d_vol1, const float* d_vol2)
{
	volume_dot_kernel<<<1, vdim.z>>>(d_vol1, d_vol2, d_per_slice);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume_normal kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching volume_normal kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result
	cudaStatus = cudaMemcpy(h_per_slice, d_per_slice, vdim.z * sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error copying to h_per_slice:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	float dot = 0;
	for (int i = 0; i < vdim.z; i++)
	{
		dot += h_per_slice[i];
	}

	return dot;
}

//Get the maximum of the volume
float volume_max(const float* d_vol, uint3 dim = vdim)
{
	volume_max_kernel<<<1, dim.z>>>(d_vol, d_per_slice, dim);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume_max kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching volume_max kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result
	cudaStatus = cudaMemcpy(h_per_slice, d_per_slice, dim.z * sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error copying to h_per_slice:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	float max = -100000000;
	for (int i = 0; i < dim.z; i++)
	{
		if (h_per_slice[i] > max)
			max = h_per_slice[i];
	}

	return max;
}

// get the minimum of the volume
float volume_min(const float* d_vol, uint3 dim = vdim)
{
	volume_min_kernel<<<1, dim.z>>>(d_vol, d_per_slice, dim);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume_min kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching volume_min kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result
	cudaStatus = cudaMemcpy(h_per_slice, d_per_slice, dim.z * sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error copying to h_per_slice:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	float min = 1000000;
	for (int i = 0; i < dim.z; i++)
	{
		if (h_per_slice[i] < min)
			min = h_per_slice[i];
	}

	return min;
}

//Returns the mean of the volume
//mean = sum of all elements / number of elements
float volume_mean(const float* d_rec_vol)
{
	volume_sum_kernel<<<1, vdim.z >>>(d_rec_vol, d_per_slice);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume_sum kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching volume_sum kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result
	cudaStatus = cudaMemcpy(h_per_slice, d_per_slice, vdim.z * sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error copying to h_per_slice:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	float sum = 0;
	for (int i = 0; i < vdim.z; i++)
	{
		sum += h_per_slice[i];
	}

	return sum/(vdim.x*vdim.y*vdim.z);
}

//volume = volume/norm(volume)
//l2 norm as if the volume was a vector (Euclidean/Frobenius)
float normalize_volume(float* d_rec_vol)
{
	float normal = volume_normal(d_rec_vol);
	scale_volume(d_rec_vol, 1.0f / normal);
	return normal;
}

//Normalize between (0 - 1) by default
//scale = max_val normalizes to (0 - max_val)
void normalize_volume_intensity(float* d_rec_vol, float scale = 1.0f)
{
	//Get max
	float max = volume_max(d_rec_vol);

	//Get min
	float min = volume_min(d_rec_vol);

	//For each voxel
	//v = scale*(v - min / max - min)
	normalize_volume_intensity_kernel<<<BPgrid, block>>>(d_rec_vol, max, min, scale);
	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "normalize_volume_intensity kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching normalize_volume_intensity kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//Stores the volume histogram in d_vol_hist
void volume_histogram(int* d_vol_hist)
{
	//Get max
	float max = volume_max(d_rec_vol);

	//Get min
	float min = volume_min(d_rec_vol);

	printf("max, min: %f, %f\n", max, min);

	//For each voxel
	//v = scale*(v - min / max - min)
	volume_histogram_kernel<<<BPgrid, block >>>(d_rec_vol, max, min, d_vol_hist);
	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "normalize_volume_intensity kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching normalize_volume_intensity kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//Lookup table style
//Old values are the keys
//The table is the scaled cumulative probabilities
void histogram_equalization(float* d_cumulative_probabilities)
{
	
	histogram_equalization_kernel<<<BPgrid, block >>>(d_rec_vol, d_cumulative_probabilities);
	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "histogram equalization  kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching histogram equalization kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_x_ladmm()
{
	update_x_ladmm_kernel<<<BPgrid, block>>>(d_rec_vol, d_z, d_y);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update x admm kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching update x admm kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//For TV+NLM LADMM
void update_x_ladmm_2()
{
	update_x_ladmm_kernel_2<<<BPgrid, block >>>(d_rec_vol, d_z, d_z_nlm, d_y, d_y_nlm);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update x admm kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching update x admm kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//Update Ytv
void update_y_ladmm()
{
	update_y_ladmm_kernel<<<BPgrid, block>>>(d_y, d_rec_vol, d_z);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update y kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
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

//Update Ynlm
void update_y_ladmm_2()
{
	update_y_ladmm_kernel_2<<<BPgrid, block>>>(d_y_nlm, d_rec_vol, d_z_nlm);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update y kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
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

void update_y_admm()
{
	update_y_admm_kernel<<<BPgrid, block >>>(d_y, d_rec_vol, d_z);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update y kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
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

void update_z_ladmm_tv()
{
	atv_po_kernel<<<BPgrid, block>>>(d_rec_vol, d_y, d_z);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update z kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching update z kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_z_ladmm_htv()
{
	htv_po_kernel<<<BPgrid, block >>>(d_rec_vol, d_y, d_z);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update z kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching update z kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_z_ladmm_nlm2d()
{
	//Copy d_rec_vol to d_rec_vol_old to preserve padding values
	cudaMemcpy(d_rec_vol_old, d_rec_vol, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying to d_rec_vol_old:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	if(nlm_xz)
		NLM_2D_XZ_kernel<<<BPgrid, block>>>(d_rec_vol, d_rec_vol_old);
	else
		NLM_2D_kernel<<<BPgrid, block>>>(d_rec_vol, d_rec_vol_old);
		

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "nlm2d launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching nlm2d kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result to d_rec_vol
	cudaMemcpy(d_rec_vol, d_rec_vol_old, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying NLM2D result to d_rec_vol:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//Znlm = NLM(x + Ynlm)
//1. Znlm = x + Ynlm (done in LADMM)
//2. NLM(Znlm) (done here)
void update_z_ladmm_nlm2d_2()
{
	//Copy d_z to d_rec_vol_old to preserve padding values
	cudaMemcpy(d_rec_vol_old, d_z_nlm, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying to d_rec_vol_old:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	if (nlm_xz)
		NLM_2D_XZ_kernel<<<BPgrid, block>>>(d_z_nlm, d_rec_vol_old);
	else
		NLM_2D_kernel<<<BPgrid, block>>>(d_z_nlm, d_rec_vol_old);


	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "nlm2d launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching nlm2d kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result to Znlm
	cudaMemcpy(d_z_nlm, d_rec_vol_old, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying NLM2D result to d_rec_vol:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_z_admm_nlm2d()
{
	//Copy z to d_rec_vol_old to preserve padding values
	cudaMemcpy(d_rec_vol_old, d_z, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying to d_rec_vol_old:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	if (nlm_xz)
		NLM_2D_XZ_kernel<<<BPgrid, block>>>(d_z, d_rec_vol_old);
	else
		NLM_2D_kernel<<<BPgrid, block >>>(d_z, d_rec_vol_old);


	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "nlm2d launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching nlm2d kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result to d_z
	cudaMemcpy(d_z, d_rec_vol_old, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying NLM2D result to d_rec_vol:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_z_ladmm_nlm3d()
{
	//Copy d_rec_vol to d_rec_vol to preserve padding values
	cudaMemcpy(d_rec_vol_old, d_rec_vol, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying to d_rec_vol_old:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	NLM_3D_kernel <<<BPgrid, block>>> (d_rec_vol, d_rec_vol_old);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "nlm3d launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching nlm3d kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result to d_rec_vol
	cudaMemcpy(d_rec_vol, d_rec_vol_old, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying NLM3D result to d_rec_vol:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_z_ladmm_nlm3d_2()
{
	//Copy Znlm to d_rec_vol to preserve padding values
	cudaMemcpy(d_rec_vol_old, d_z_nlm, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying to d_rec_vol_old:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	NLM_3D_kernel<<<BPgrid, block>>>(d_z_nlm, d_rec_vol_old);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "nlm3d launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching nlm3d kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result to Znlm
	cudaMemcpy(d_z_nlm, d_rec_vol_old, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying NLM3D result to d_rec_vol:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_z_admm_nlm3d()
{
	//Copy d_z to d_rec_vol to preserve padding values
	cudaMemcpy(d_rec_vol_old, d_z, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying to d_rec_vol_old:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	NLM_3D_kernel <<<BPgrid, block >>>(d_z, d_rec_vol_old);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "nlm3d launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching nlm3d kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy result to d_z
	cudaMemcpy(d_z, d_rec_vol_old, recon_size, cudaMemcpyDeviceToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Error after copying NLM3D result to d_rec_vol:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void update_x_primal_dual()
{
	update_x_pd_kernel<<<BPgrid, block>>>(d_rec_vol, d_z);

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

void update_y_primal_dual()
{
	update_y_pd_kernel<<<BPgrid, block>>>(d_y, d_rec_vol_old, d_rec_vol);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "update y kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
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

void update_z_primal_dual()
{
	update_z_pd_kernel<<<BPgrid, block>>>(d_z, d_y);

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

//Save current h_rec_vol as .hdr
void sv(string fname)
{
	h_rec_vol.save_analyze(fname.c_str());
}

//Save current h_rec_vol as .hdr
void sv_piece(string fname)
{
	h_piece.save_analyze(fname.c_str());
}

//Saves current d_rec_vol as .hdr
//If normalize, the volume is copied to d_rec_vol_old, normalized and saved
//fname doesn't require .hdr
void save_hdr(string fname, bool normalize = false)
{
	//Wait for current saving process, if any.
	if (save_thread.joinable())
		save_thread.join();	

	if (normalize && (algo != ALGORITHM::L_ADMM))
	{
		// Copy rec_vol to rec_vol_old
		cudaStatus = cudaMemcpy(d_rec_vol_old, d_rec_vol, recon_size, cudaMemcpyDeviceToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "rec. vol. cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Normalize to 0 - 1
		normalize_volume_intensity(d_rec_vol_old);

		// Copy volume to host
		cudaStatus = cudaMemcpy(h_rec_vol.data(), d_rec_vol_old, recon_size, cudaMemcpyDeviceToHost);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaMemcpy failed when copying back rec. vol!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Save volume and slice
		save_thread = thread(sv, "D:/results/New/" + fname + "_norm.hdr");
	}
	else
	{
		if (tiled)
		{

			//For each XY slice
			for (int i = 0; i < vdim.z; i++)
			{
				// Copy output reconstruction from GPU buffer to host memory.
				cudaStatus = cudaMemcpy(h_rec_vol._data + i*vdim.x*pdim.y + current_tile*vdim.x*tile_size, d_rec_vol + i*vdim.x*vdim.y + (number_extra_rows/2)*vdim.x, vdim.x*tile_size*sizeof(float), cudaMemcpyDeviceToHost);
				if (cudaStatus != cudaSuccess) {
					fprintf(stderr, "cudaMemcpy failed when copying back rec. vol!\n%s\n", cudaGetErrorString(cudaStatus));
					error();
				}
			}
		}
		else
		{
			// Copy output reconstruction from GPU buffer to host memory.
			cudaStatus = cudaMemcpy(h_rec_vol.data(), d_rec_vol, recon_size, cudaMemcpyDeviceToHost);
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "cudaMemcpy failed when copying back rec. vol!\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}		

		//Save volume
		save_thread = thread(sv, fname + ".hdr");
	}
}

//Saves the piece to the disk.
//Extension not required in fname
//Omits extra rows
void save_hdr_piece(string fname)
{
	if (tiled)
	{
		//Wait for current saving process, if any.
		if (save_thread.joinable())
			save_thread.join();

		//Save by XY slices
		for (int i = 0; i < vdim.z; i++)
		{
			// Copy output reconstruction from GPU buffer to host memory.
			cudaStatus = cudaMemcpy(h_piece._data + i*vdim.x*tile_size, d_rec_vol + i*vdim.x*vdim.y + (number_extra_rows/2)*vdim.x, vdim.x*tile_size*sizeof(float), cudaMemcpyDeviceToHost);
			//cudaStatus = cudaMemcpy(h_piece._data + i*vdim.x*vdim.y, d_rec_vol + i*vdim.x*vdim.y, vdim.x*vdim.y*sizeof(float), cudaMemcpyDeviceToHost);
			if (cudaStatus != cudaSuccess)
			{
				fprintf(stderr, "cudaMemcpy failed when saving piece!\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}		

		save_thread = thread(sv_piece, fname + ".hdr");
	}
}

//Stores the current d_rec_vol piece
//Into the host's h_rec_vol, in the corresponding piece
void copy_piece_to_host(CImgFloat &host_volume = h_rec_vol, float* device_volume = d_rec_vol)
{
	if (tiled)
	{
		//We need to skip the extra rows.
		//The data is copied slice by slice to be able to do this
		for (int i = 0; i < vdim.z; i++)
		{
			//Copy piece slice (ignoring fist and last rows)
			//from device to host volume in the corresponding piece.
			cudaStatus = cudaMemcpy(host_volume._data + i*vdim.x*pdim.y + current_tile*vdim.x*tile_size, device_volume + i*vdim.x*vdim.y + (number_extra_rows/2)*vdim.x, vdim.x*tile_size*sizeof(float), cudaMemcpyDeviceToHost);
			if (cudaStatus != cudaSuccess)
			{
				fprintf(stderr, "cudaMemcpy failed when copying back piece!\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
		}
	}
	else
	{
		//Copy whole volume
		cudaStatus = cudaMemcpy(host_volume._data, device_volume, vdim.x*vdim.y*vdim.z*sizeof(float), cudaMemcpyDeviceToHost);
		if (cudaStatus != cudaSuccess)
		{
			fprintf(stderr, "cudaMemcpy failed when copying back piece!\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}
}

//Allocate device memory and copy original projection data
void allocate_memory()
{
	size_t gpu_memory_size = 0;
	
	// Choose which GPU to run on, change this on a multi-GPU system.
	cudaStatus = cudaSetDevice(0);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaSetDevice failed:  Do you have a CUDA-capable GPU installed?\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU original projection data 
	cudaStatus = cudaMalloc((void**)&d_proj_data, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += data_size;

	// Allocate GPU recon vol data
	cudaStatus = cudaMalloc((void**)&d_rec_vol, recon_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "rec. vol. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += recon_size;

	// Allocate GPU correction image    
	cudaStatus = cudaMalloc((void**)&d_corr_img, proj_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "corr. img. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += proj_size;

	if (data_term_operator == DATA_TERM_OPERATOR::SIRT || data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT || compute_error)
	{
		//if ((data_term_operator == DATA_TERM_OPERATOR::SIRT || data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT) && compute_error)
		//{
		//	printf("SIRT && compute error are not ready to work together\n");
		//	error();
		//}			
		// Allocate GPU correction images (SIRT, compute error)
		cudaStatus = cudaMalloc((void**)&d_corr_imgs, pdim.z*proj_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "corr. imsg. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += pdim.z*proj_size;
	}	

	if (data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT)
	{
		// Allocate GPU weight images (SIRT)
		cudaStatus = cudaMalloc((void**)&d_weight_imgs, pdim.z*proj_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "corr. imsg. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += pdim.z*proj_size;
	}

	// Allocate GPU raysum image    
	cudaStatus = cudaMalloc((void**)&d_raysum_img, proj_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "raysum. img. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += proj_size;

	// Allocate GPU weight image    
	cudaStatus = cudaMalloc((void**)&d_weight_img, proj_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "weigth. img. cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += proj_size;

	// Allocate GPU slack variable for data term
	cudaStatus = cudaMalloc((void**)&d_yslack, proj_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "yslack cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += proj_size;

	if  (((alg <= 3) || alg == 16) && ((data_term_operator == DATA_TERM_OPERATOR::SIRT) || (data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT)))
	{
		// Allocate GPU slackS variable for sirt data term
		cudaStatus = cudaMalloc((void**)&d_yslacks, pdim.z*proj_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "yslacks cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += pdim.z*proj_size;
	}	


	if (algo == ALGORITHM::L_ADMM)
	{
		// Allocate GPU y admm
		cudaStatus = cudaMalloc((void**)&d_y, 3*recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += 3*recon_size;

		// Allocate GPU z admm
		cudaStatus = cudaMalloc((void**)&d_z, 3*recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "z admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += 3 * recon_size;

		if (nlm_finish_2d || nlm_finish_3d || (denoise_operator == DENOISE_OPERATOR::NLM2D) || (denoise_operator == DENOISE_OPERATOR::NLM3D))
		{
			// Allocate old vol
			cudaStatus = cudaMalloc((void**)&d_rec_vol_old, recon_size);
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "d_rec_vol_old ladmm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
			gpu_memory_size += recon_size;
		}

		if(ladmm_variant == 3)
		{
			// Allocate GPU y_nlm
			cudaStatus = cudaMalloc((void**)&d_y_nlm, recon_size);
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "y_nlm admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
			gpu_memory_size += recon_size;

			// Allocate GPU z_nlm
			cudaStatus = cudaMalloc((void**)&d_z_nlm, recon_size);
			if (cudaStatus != cudaSuccess) {
				fprintf(stderr, "z_nlm admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
				error();
			}
			gpu_memory_size += recon_size;
		}
	}
	else if (algo == ALGORITHM::PRIMAL_DUAL)
	{
		// Allocate GPU y PD
		cudaStatus = cudaMalloc((void**)&d_y, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += recon_size;

		// Allocate GPU z PD
		cudaStatus = cudaMalloc((void**)&d_z, 3*recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "z admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += 3 * recon_size;

		// Allocate GPU rec_vol_old PD
		cudaStatus = cudaMalloc((void**)&d_rec_vol_old, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "d_rec_vol_old cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += recon_size;
	}
	else if (algo == ALGORITHM::POWER_METHOD)
	{

		// Allocate GPU z PM
		cudaStatus = cudaMalloc((void**)&d_z, 3*recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "z admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += 3 * recon_size;

		// Allocate GPU rec_vol_old PMs
		cudaStatus = cudaMalloc((void**)&d_rec_vol_old, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "d_rec_vol_old cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += recon_size;
	}
	else if (algo == ALGORITHM::ADMM)
	{
		// Allocate GPU y admm
		cudaStatus = cudaMalloc((void**)&d_y, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "y admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += recon_size;

		// Allocate GPU z admm
		cudaStatus = cudaMalloc((void**)&d_z, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "z admm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += recon_size;
		
		// Allocate old vol
		cudaStatus = cudaMalloc((void**)&d_rec_vol_old, recon_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "d_rec_vol_old ladmm cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
		gpu_memory_size += recon_size;
	}

	//Allocate device per_slice
	cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z * sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "d_per_slice cudamalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	gpu_memory_size += vdim.z*sizeof(float);

	printf("Allocating device memory: %f GB required...\n", (float)gpu_memory_size / 1000000000); //Divided to have GBs..

	// Copy projections to GPU
	cudaStatus = cudaMemcpy(d_proj_data, h_proj_data.data(), data_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}	

	printf("Device memory allocated succesfully. Projection data copied succesfully...\n\n");
}

void multiply_volumes(const float* d_vol1, const float* d_vol2, float* d_dst)
{
	multiply_volumes_kernel<<<BPgrid, block>>>(d_vol1, d_vol2, d_dst);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "multiply_volumes kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching multiply_volumes kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

//Rayleigh quotient : R(M, x) = Mx*x / x*x
//A must be symmetric
float rayleigh_quotient(const float* d_rec_vol)
{
	//x*x = l2norm(x)^2, assuming that shape of x is nx1
	float xx = volume_normal(d_rec_vol);
	xx = xx * xx;

	//M*x = (A^T*A)*x
	volume_gradient(d_rec_vol, d_z);
	volume_divergence(d_z, d_rec_vol_old);

	//x*Mx
	//sum of element-wise multiplication / dot product
	float dot = volume_dot(d_rec_vol, d_rec_vol_old);

	return dot / xx;
}

//Returns squared l2norm of the gradient matrix
//Needs to be done once for every x y z volume dimensions
//Vector b (volume) = d_rec_vol, initialize properly
//b = A^T*A*b / ||A^T*A*b||
float power_method()
{
	int power_iterations = 4000;
	float norm_squared;

	printf("Iteration %d/%d", 0, power_iterations);

	for (int i = 0; i < power_iterations; i++)
	{        
		clock_t start_time = clock();				
		
		//d_z = A*b = grad(b)
		volume_gradient(d_rec_vol, d_z); //Initialize with PD or LADMM for d_z 4D

		//d_rec_vol = A^T*(A*b) =  div(d_z)
		volume_divergence(d_z, d_rec_vol);

		//b = normalize(b)
		//Not required, but good to avoid huge or too small norms
		if ((i+1)%10 == 0)
			normalize_volume(d_rec_vol);

		double elapsed_secs = double(clock() - start_time) / CLOCKS_PER_SEC;
		printf("\rIteration %d/%d. Time taken for last iteration: %f s.", i + 1, power_iterations, elapsed_secs);

		if (((i+1)%50 == 0))
			printf("\nIteration %d, result: %f\n", i+1, rayleigh_quotient(d_rec_vol));
	}

	//Compute ||A||^2 = lambda1
	//Use Rayleigh quotient: R(M,x) = x'*M*x / x'*x
	//R(M,max_eigvec) = max_eigval
	return  rayleigh_quotient(d_rec_vol);
}

void hdr2mrc(string filename)
{
	//open hdr
	CImgFloat hdr;
	hdr.load_analyze(filename.c_str());

	//Replace extension
	filename.erase(filename.end() - 3, filename.end());
	filename = filename + "mrc";
	
	//save mrc
	uint3 dim = make_uint3(hdr.width(), hdr.height(), hdr.depth());
	smrc(filename, hdr._data, dim);
}

void mrc2hdr(string filename)
{
	//open mrc
	if (mrcParser.load_original(filename) == -1)
		error();

	//Replace extension
	filename.erase(filename.end() - 3, filename.end());
	filename = filename + "hdr";

	//save hdr
	CImgFloat hdr = CImgFloat(mrcParser.dimensions(0), mrcParser.dimensions(1), mrcParser.dimensions(2), 1, 0);
	hdr._data = mrcParser.getData();
	hdr.save_analyze(filename.c_str());
}

//Crops the horizontal dimension to 1024
//Accepts .hdr or .mrc
//format = true to save hdr, false to save mrc
void crop_vol(string fname, bool format = true)
{
	//Check if file is hdr or mrc
	bool hdr;
	if (fname.back() == 'r')
		hdr = true;
	else
		hdr = false;

	CImgFloat tocrop;

	if (!hdr)
	{
		if (mrcParser.load_original(fname) == -1)
		error();
	}	
	else
		tocrop.load(fname.c_str());

	//Original dimensions
	uint3 odim;
	if (hdr)
	{
		odim.x = tocrop.width();
		odim.y = tocrop.height();
		odim.z = tocrop.depth();
	}
	else
	{
		odim.x = mrcParser.dimensions(0);
		odim.y = mrcParser.dimensions(1);
		odim.z = mrcParser.dimensions(2);
	}	

	printf("odim: %d, %d, %d\n", odim.x, odim.y, odim.z);

	float min = 0, max = 0, mean = 0;
	if (!hdr)
	{
		mrcParser.getmmm(min, max, mean);
		printf("mmm: %f, %f, %f\n", min, max, mean);
	}	

	//Original volume GPU object
	cudaStatus = cudaMalloc((void**)&d_rec_vol, odim.x*odim.y*odim.z*sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "original vol cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//New dimensions
	vdim = odim;
	vdim.x = 1024;

	//Cropped volume GPU object
	cudaStatus = cudaMalloc((void**)&d_rec_vol_old, vdim.x*vdim.y*vdim.z*sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cropped vol cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy original volume to GPU
	if(hdr)
		cudaStatus = cudaMemcpy(d_rec_vol, tocrop._data, odim.x*odim.y*odim.z*sizeof(float), cudaMemcpyHostToDevice);
	else
		cudaStatus = cudaMemcpy(d_rec_vol, mrcParser.getData(), odim.x*odim.y*odim.z*sizeof(float), cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "original vol. cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	printf("ndim: %d, %d, %d\n", vdim.x, vdim.y, vdim.z);

	padding = (odim.x - vdim.x)/2;

	printf("padding: %d\n", padding);

	block = dim3(vdim.x);
	FPgrid = dim3(vdim.y, vdim.z);
	crop_vol_kernel<<<FPgrid, block>>>(d_rec_vol, d_rec_vol_old, padding, odim, vdim);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "crop vol kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching crop vol kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	if ((!hdr) && (min == 0) && (max == 0) && (mean == 0))
	{
		// Allocate GPU d_per_slice
		cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z * sizeof(float));
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		h_per_slice = new float[vdim.z];

		min = volume_min(d_rec_vol_old);
		max = volume_max(d_rec_vol_old);
		mean = volume_mean(d_rec_vol_old);
	}

	CImgFloat cropped = CImgFloat(vdim.x, vdim.y, vdim.z, 1, 0.0f);

	//Copy back cropped vol
	cudaStatus = cudaMemcpy(cropped._data, d_rec_vol_old, vdim.x*vdim.y*vdim.z*sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "copy back cropped vol cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	printf("Cropped succesfully. Saving...\n");

	//Replace extension and save
	fname.erase(fname.end() - 4, fname.end());
	if (format)
	{
		fname = fname + "_cropped.hdr";
		cropped.save_analyze(fname.c_str());
	}		
	else
	{
		fname = fname + "_cropped.mrc";
		smrc(fname, cropped._data, vdim, min, max, mean);
	}

	clear_device();
}

//Returns a profile of an XY slice
//Returns a vector where each element is the sum of a column of the slice
//pslice = -1 for middle slice
void slice_profile(string fname, int pslice)
{
	//Load volume
	CImgFloat vol;
	vol.load(fname.c_str());

	//Default slice is the middle
	if (pslice == -1)
		pslice = (vol._depth / 2) - 1;

	//File to store the column sumns
	std::ofstream MyFile("profile_" + to_string(pslice) + ".txt");

	for (int i = 0; i < vol._width; i++)
	{
		float colsum = 0;

		for (int j = 0; j < vol._height; j++)
		{
			colsum += vol._data[i + j*vol._width + pslice*vol._height*vol._width];			
		}

		MyFile << to_string(colsum) << std::endl;// << std::endl;
	}

	MyFile.close();	
}

void slice_profile(string fname)
{
	//Load volume
	CImgFloat vol;
	vol.load(fname.c_str());

	for (int psl = 0; psl <= vol._depth; psl+=10)
	{
		if (psl == vol._depth)
			psl--;

		//File to store the column sumns
		std::ofstream MyFile("profile_" + to_string(psl) + ".txt");		

		for (int i = 0; i < vol._width; i++)
		{
			float colsum = 0;

			for (int j = 0; j < vol._height; j++)
			{
				colsum += vol._data[i + j*vol._width + psl*vol._height*vol._width];
			}

			MyFile << to_string(colsum) << std::endl;// << std::endl;
		}

		MyFile.close();
	}
}

//Save any image of proj_size
//Saved as .hdr. fname doesnt require extension
//saved as fname_itercurrentproj
void save_img(float* d_img, string fname)
{
	CImgFloat img = CImgFloat(pdim.x, pdim.y, 1, 1, 0);

	// Copy correction image from GPU to host
	cudaStatus = cudaMemcpy(img.data(), d_img, proj_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying back d_img!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Save volume
	img.save_analyze((fname + ".hdr").c_str());
}

//Get radians from angle
float radians(float angle)
{
	return (angle * PI) / (float)180;
}

//Pass only the name and by default d_rec_vol will be saved.
//Pass a GPU data object and the size of the object and the object will be saved.
void save_mrc(string filepath, float* data = d_rec_vol, uint3 dim = vdim)
{
	//Get min, max, mean
	//float min =  volume_min(data, dim);
	//float max =  volume_max(data, dim);
	//float mean = volume_mean(data, dim);

	//Wait for current saving process, if any.
	if (save_thread.joinable())
		save_thread.join();

	// Copy volume to host
	cudaStatus = cudaMemcpy(h_rec_vol.data(), data, dim.x*dim.y*dim.z*sizeof(float), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying back rec. vol for save)mrc!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	h_rec_vol.save_analyze(filepath.c_str());

	//Save in independent thread
	//save_thread = thread(smrc, filepath + ".mrc", h_rec_vol._data, dim, 0, 0, 0/*, min, max, mean*/);
}

//Load the kernel into an array
void load_kernel_lookup()
{
	std::ifstream file;
	string kernel_filename;
	#ifdef _WIN32
		kernel_filename = "..\\..\\src\\";
	#else
		kernel_filename =  "../src/";
	#endif
	kernel_filename += splat_kernel;
	file.open(kernel_filename.c_str());
	if (!file) {
		printf("Unable to open splat kernel file!\n");
		error();  
	}	

	float dd;
	int i = 0;
	while (file >> dd) {
		if (i > 20000)
		{
			printf("Error loading kernel!\n");
			error();
		}
		kernel_lookup[i] = dd;
		if(normalize_kernel)
			kernel_lookup[i] = kernel_lookup[i] / kernel_lookup[0];
		i++;
	}

	if (i != 20001)
	{
		printf("Error loading kernel!\n");
		error();
	}

	printf("Loaded kernel file: %s\n", splat_kernel.c_str());

	file.close();
}

//Parse the arguments to set the reconstruction
//First parameter is always software name ./CUDA_PROXIMAL_SART
//Then we have: param1 value1 param2 value2...
//arguments are:
//data_term_iters (unsigned int)
//proximal_iters (unsigned int)
//sample_rate (float)
//chill_factor (float)
//lambda, which is sqrt(2*lambda) (float)
//alg, which must be one of the following:
//	1: Proximal iteration
//	2: Linearized ADMM
//	3: Primal dual 
//	4: Power method
//	5: hdr2mrc
//	6: project_volume
//	7: crop
//	8: mrc2hdr
//	9: XY slice profile
//  10: Linearize projections
//  11: delinearize volume
//filename (string)
void parse_commands(int argc, char **argv)
{
	printf("\n************************************************\n\n");

	//Get all arguments into a vector of strings
	//Omit initial argument, which is binary's name
	vector<string> argument_list;
	for (int i = 1; i < argc; i++)
	{
		argument_list.push_back(string(argv[i]));
	}

	//Set experiment here

	//Number of iterations for inner data term loop
	string arg = "data_term_iters";
	vector<string>::const_iterator argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		data_term_iters = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		data_term_iters = 2; //Default value
	}		

	arg = "proximal_iters";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		proximal_iters = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		proximal_iters = 15; //Default value
	}	

	arg = "ladmm_variant";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		ladmm_variant = stoi(*(++argument)); //Retrieve parameter value
	}

	//SART recommends picture element size/2 (0.5)
	//precision by 2 < by 4 < by 8 < by 16... 8 seems like a good tradeoff, maybe 4
	arg = "sample_rate";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		sample_rate = stod(*(++argument));	
	}
	else
	{
		sample_rate = 0.5; //Default value
	}

	arg = "normalize_max";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		sample_rate = stod(*(++argument));
	}

	arg = "noise_mean";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		cost = stod(*(++argument));
	}

	arg = "noise_variance";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		sint = stod(*(++argument));
	}

	//Algorithm to use, list above in parser description
	arg = "alg";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		alg = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		alg = 2;
	}

	arg = "data_term_operator";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		string dtop = *(++argument);
		if ((dtop == "SIRT") || (dtop == "sirt"))
			data_term_operator = DATA_TERM_OPERATOR::SIRT;
		else if ((dtop == "SART") || (dtop == "sart"))
			data_term_operator = DATA_TERM_OPERATOR::SART;
		else if ((dtop == "SIRT_SPLAT") || (dtop == "sirt_splat"))
			data_term_operator = DATA_TERM_OPERATOR::SIRT_SPLAT;
		else
			data_term_operator = DATA_TERM_OPERATOR::SART_SPLAT;
	}
	else
	{
		if (alg == 21)
			data_term_operator = DATA_TERM_OPERATOR::SIRT;
		else if (alg == 23)
			data_term_operator = DATA_TERM_OPERATOR::SIRT_SPLAT;
		else if (alg == 22)
			data_term_operator = DATA_TERM_OPERATOR::SART_SPLAT;
		else
			data_term_operator = DATA_TERM_OPERATOR::SART;
	}

	//Forward and backward projection constants
	arg = "chill_factor";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		chill_factor = stod(*(++argument)); //Retrieve parameter value
	}
	else
	{
		if((data_term_operator == DATA_TERM_OPERATOR::SART) || (data_term_operator == DATA_TERM_OPERATOR::SART_SPLAT))
			chill_factor = 0.2f; //Relaxation term in backprojection for SART
		else
			chill_factor = 0.05f; //Relaxation term in backprojection for SIRT
	}

	arg = "lambda";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		lambda = sqrt(2*stod(*(++argument))); //Retrieve parameter value
	}
	else
	{
		lambda = sqrt(2*1000);  //This is sqrt(2*lambda), regularization term for proximal sart
	}

	arg = "huber_lambda";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		huber_lambda = stod(*(++argument)); //Retrieve parameter value
	}

	arg = "filename";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		filename = *(++argument); //Retrieve parameter value
	}
	else
	{
		filename = "ts_1.ali";
	}

	arg = "splat_kernel";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		splat_kernel = *(++argument); //Retrieve parameter value
	}

	arg = "axes_order";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		splat_kernel = *(++argument); //Retrieve parameter value
	}

	arg = "angles_list_filename";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		angles_list_filename = *(++argument); //Retrieve parameter value
	}

	arg = "volume_to_project";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		volume_to_project = *(++argument); //Retrieve parameter value
	}

	//number_of_tiles
	arg = "number_of_tiles";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		number_of_tiles = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		number_of_tiles = 4;
	}

	arg = "tiled";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		tiled = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		if (number_of_tiles > 1)
			tiled = true;
		else
			tiled = false;
	}

	arg = "number_of_projections";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		number_of_tiles = stoi(*(++argument)); //Retrieve parameter value
	}

	//number_extra_rows
	arg = "number_extra_rows";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		number_extra_rows = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		if (tiled)
			number_extra_rows = 80;
		else
			number_extra_rows = 0;
	}

	//LADMM
	//ro
	arg = "ro";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		ro = stod(*(++argument)); //Retrieve parameter value
	}
	else
	{
		ro = 50;
	}
	//sigma
	arg = "sigma";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		sigma = stod(*(++argument)); //Retrieve parameter value
	}
	else
	{
		sigma = 0.01;
	}

	//PD
	//gamma_pd
	arg = "gamma";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		gamma_pd = stod(*(++argument)); //Retrieve parameter value
	}

	arg = "normalize_max";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		gamma_pd = stod(*(++argument));
	}

	//theta
	arg = "theta";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		theta = stod(*(++argument)); //Retrieve parameter value
	}
	else
	{
		theta = 1;
	}
	//sigma done already

	//Volume depth
	arg = "volume_depth";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		volume_depth = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		volume_depth = 300;
	}	

	arg = "denoise_operator";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		string dtop = *(++argument);
		if ((dtop == "TV") || (dtop == "tv"))
			denoise_operator = DENOISE_OPERATOR::TV;
		else if ((dtop == "huber") || (dtop == "HUBER"))
			denoise_operator = DENOISE_OPERATOR::HTV;
		else if ((dtop == "nlm2d") || (dtop == "NLM2D"))
			denoise_operator = DENOISE_OPERATOR::NLM2D;
		else if ((dtop == "nlm3d") || (dtop == "NLM3D"))
			denoise_operator = DENOISE_OPERATOR::NLM3D;
	}
	else
	{
		if((alg == 2) || (alg == 3))
			denoise_operator = DENOISE_OPERATOR::TV;
		else if (alg == 16)
			denoise_operator = DENOISE_OPERATOR::NLM2D;
	}

	arg = "random_projection_order";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		random_projection_order = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		random_projection_order = true;
	}

	arg = "check_convergence";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		check_convergence = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nlm_h";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_h = stod(*(++argument)); //Retrieve parameter value
	}
	else
	{
		nlm_h = 0.000004;
	}

	arg = "nlm_s";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_s = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		nlm_s = 21;
	}

	//Check that nlm_s is odd
	if (nlm_s % 2 == 0)
		nlm_s++;

	arg = "nlm_w";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_w = stoi(*(++argument)); //Retrieve parameter value
	}
	else
	{
		nlm_w = 7;
	}

	//Check that nlm_w is odd
	if (nlm_w % 2 == 0)
		nlm_w++;

	arg = "nlm_finish_2d";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_finish_2d = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nlm_finish_3d";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_finish_3d = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nlm_last_iters";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_last_iters = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nlm_skip";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_skip = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nlm_weight_xz";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_weight_xz = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "data_term_end";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		data_term_end = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nlm_xz";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nlm_xz = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "number_of_bins";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		number_of_bins = stoi(*(++argument)); //Retrieve parameter value
	}
	
	arg = "crop";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		crop = stoi(*(++argument)); //Retrieve parameter value
	}
	
	arg = "gamma_correct";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		gamma_correct = stod(*(++argument)); //Retrieve parameter value
	}

	arg = "i_0";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		i_0 = stod(*(++argument));
	}

	arg = "is_data_linearized";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		is_data_linearized = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "delinearize_result";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		delinearize_result = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "compute_error";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		compute_error = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "add_noise";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		compute_error = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "intermediate_list";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		string list = *(++argument); //Retrieve parameter value

		std::stringstream ss(list);

		for (int i; ss >> i;)
		{
			intermediate_volumes_list.push_back(i);
			if (ss.peek() == ',')
				ss.ignore();
		}

	}

	arg = "leave_out";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		string list = *(++argument); //Retrieve parameter value

		std::stringstream ss(list);

		for (int i; ss >> i;)
		{
			intermediate_volumes_list.push_back(i);
			if (ss.peek() == ',')
				ss.ignore();
		}

	}

	arg = "result_filename";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		result_filename = *(++argument); //Retrieve parameter value
	}

	arg = "ignore_padding";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		ignore_padding = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "nonnegativity";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		nonnegativity = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "normalize_kernel";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		normalize_kernel = stoi(*(++argument)); //Retrieve parameter value
	}

	arg = "ref_vol";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		filename = *(++argument); //Retrieve parameter value
	}

	arg = "res_vol";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		result_filename = *(++argument); //Retrieve parameter value
	}

	arg = "starting_angle";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		starting_angle = stod(*(++argument)); //Retrieve parameter value
	}

	arg = "angle_step";
	argument = find(argument_list.begin(), argument_list.end(), arg.c_str());
	if (argument != argument_list.end()) //If nothing found, argument points to argument_list.end()
	{
		angle_step = stod(*(++argument)); //Retrieve parameter value
	}

	if ((alg <= 3) || (alg == 16) || (alg == 28) || ((alg >= 20) && (alg <= 23)))
	{
		printf("# data term iters: %d\n", data_term_iters);
		if ((alg <= 3) || (alg == 28))
			printf("# Proximal iters: %d\n", proximal_iters);
		if ((starting_angle != 0.0f) && (angle_step != 0.0f))
			printf("Starting angle %f, angle step %f\n", starting_angle, angle_step);
		printf("Data term operator: %d\n", data_term_operator);
		if (((alg > 1) && (alg <= 3)) || alg == 16  || (alg == 28))
			printf("Denoise operator: %d\n", denoise_operator);
		if ((data_term_operator != DATA_TERM_OPERATOR::SART_SPLAT) && (data_term_operator != DATA_TERM_OPERATOR::SIRT_SPLAT))
			printf("sample rate: %f\n", sample_rate);
		printf("Relaxation factor: %f\n", chill_factor);
		if ((alg <= 3) || (alg == 28))
			printf("Data term lambda: %f\n", 0.5*lambda*lambda);
		printf("alg: %d\n", alg);
		printf("filename: %s\n", filename.c_str());
		printf("tiled: %d\n", tiled);
		if (tiled && (number_of_tiles > 1))
		{
			printf("number_of_tiles: %d\n", number_of_tiles);
			printf("number_extra_rows: %d\n", number_extra_rows);
		}
		printf("ro: %f\n", ro);
		printf("sigma: %f\n", sigma);
		printf("huber_lambda: %f\n", huber_lambda);
		printf("gamma: %f\n", gamma_pd);
		printf("theta: %f\n", theta);
		printf("volume depth: %d\n", volume_depth);
		if (random_projection_order)
			printf("random projection order\n");
		if ((nlm_finish_2d) || (nlm_finish_3d) || (denoise_operator == DENOISE_OPERATOR::NLM2D) || (denoise_operator == DENOISE_OPERATOR::NLM3D))
		{
			printf("2DNLM last iterations: %d\n", nlm_finish_2d);
			printf("3DNLM last iterations: %d\n", nlm_finish_3d);
			printf("# NLM last iters: %d\n", nlm_last_iters);
			printf("NLM filtering parameter 'nlm_h' (squared): %f\n", nlm_h);
			printf("NLM search window size 'nlm_s': %d\n", nlm_s);
			printf("NLM patch size 'nlm_w': %d\n", nlm_w);
			printf("NLM skip: %d\n", nlm_skip);
			printf("NLM weights xz: %d\n", nlm_weight_xz);
			printf("NLM XZ: %d\n", nlm_xz);
		}
		printf("Data term in the end?: %d\n", data_term_end);
		printf("Is projection data linearized?: %d\n", is_data_linearized);
		printf("Delinearize results?: %d\n", delinearize_result);
		if (intermediate_volumes_list.size())
		{
			printf("intermediate list: ");
			for (int i = 0; i < intermediate_volumes_list.size(); i++)
			{
				printf("%d ", intermediate_volumes_list[i]);
			}
			printf("\n");
		}
		if (result_filename != "")
			printf("result_filename: %s\n", result_filename.c_str());
		if ((data_term_operator == DATA_TERM_OPERATOR::SART_SPLAT) || (data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT))
		{
			printf("splat kernel: %s\n", splat_kernel.c_str());
			if (normalize_kernel)
				printf("Normalize kernel: %d\n", normalize_kernel);
		}

		if (!nonnegativity)
			printf("nonnegativity disabled!");
		printf("\n************************************************\n\n");
	}
	
}

//Return name of current algorithm
//To use with generate_filename
string alg_name()
{
	string result;
	switch(alg)
	{
		case 1:
			result = string("prox_iter");
			break;
		case 2:
			result = string("ladmm");
			break;
		case 3:
			result = string("primal_dual");
			break;
		case 16:
			result = string("admm");
			break;
		case 20:
			result = string("sart");
			break;
		case 21:
			result = string("sirt");
			break;
		case 22:
			result = string("sart_splat");
			break;
		case 23:
			result = string("sirt_splat");
			break;
		case 28:
			result = string("ladmm_admm");
			break;
		default:
			result = string("");
			break;
	}
	return result;
}

string generate_filename()
{
	string file_name = filename;
	size_t found = file_name.find("/");
	while (found != string::npos) //Replace all '/' with _
	{
		file_name.replace(found, 1, "_");
		found = file_name.find("/");
	}

	file_name.erase(file_name.length() - 4); //Remove extension

	if (!nonnegativity)
		file_name += "_noneg_disabled";

	file_name += "_" + alg_name() + "_data_op" + to_string(data_term_operator);

	switch (ladmm_variant)
	{

	case 1: case 2: case 3: 
		file_name += "_lv" + to_string(ladmm_variant);
		break;
	}

	if ((data_term_operator == DATA_TERM_OPERATOR::SART_SPLAT) || (data_term_operator == DATA_TERM_OPERATOR::SIRT_SPLAT))
	{
		file_name += splat_kernel.substr(0, splat_kernel.length() - 4);
		if (normalize_kernel)
			file_name += "normalized";
	}
	
	file_name += "_" + to_string(data_term_iters) + "x" + to_string(proximal_iters) + "_d" + to_string(volume_depth);

	if(tiled)
	{	
		file_name += "_tiled" + to_string(number_of_tiles) + "x" + to_string(number_extra_rows);
	}

	if (random_projection_order)
		file_name += "_rop";

	if ((alg == 2) || (alg == 28))
	{
		file_name += "_ro" + to_string(ro) + "_sigma" + to_string(sigma);
	}
	else if (alg == 3)
	{
		file_name += "_sigma" + to_string(sigma) + "_gamma" + to_string(gamma_pd) + "_theta" + to_string(theta);
	}

	if (denoise_operator == DENOISE_OPERATOR::HTV)
	{
		file_name += "_huber" + to_string(huber_lambda);
	}

	if (denoise_operator == DENOISE_OPERATOR::NLM2D || denoise_operator == DENOISE_OPERATOR::NLM3D || nlm_finish_2d || nlm_finish_3d || alg == 16)
	{
		if (nlm_finish_3d || denoise_operator == DENOISE_OPERATOR::NLM3D)
			file_name += "_3Dnlm_h";
		else
			file_name += "_nlm_h";

		if (nlm_h >= 0.000001)
			file_name += to_string(nlm_h);
		else
		{
			file_name += "0.000000";
			string temp = to_string(1000000.0f*nlm_h);
			temp.erase(temp.begin(), temp.begin() + 2);
			while (temp.back() == '0')
			{
				temp.pop_back();
			}
			file_name += temp;
		}
			

		file_name += "_nlm_s" + to_string(nlm_s) + "_nlm_w" + to_string(nlm_w) + "_nlm_last_iters" + to_string(nlm_last_iters);

		if (nlm_skip > 1)
			file_name += "_nlm_skip" + to_string(nlm_skip);

		if (nlm_weight_xz)
			file_name += "_nlm_weight_XZ";

		if (nlm_xz)
			file_name += "_nlm_XZ";
	}

	if (data_term_end)
	{
		file_name += "_data_term_end";
	}

	if (chill_factor != 0.2f)
	{
		file_name += "_cf" + to_string(chill_factor);
	}

	if (lambda != sqrtf(2*1000))
	{
		file_name += "_lambda" + to_string(0.5*lambda*lambda);
	}

	if (angles_list_filename != "")
	{
		file_name += "_tlt_" + angles_list_filename;
	}

	return file_name;
}

//This function is used to linearize the projection data
//The measured projection images correspond to attenuation
//The raysum of density values can be extracted using logarithm preprocessing
//as described in 'Computed tomography, principles, design, artifacts, and recent advancements'
//Third edition section 2.3 page 44
//raysum = -ln(i/i_0) = line integral of densities in ray's direction
//Where i_0 is the initial (entrance) xray intensity and i is the attenuated (exit) xray intensity.
//i_0 is computed as the maximum value of the projections
//set file to linearize using filename
void linearize_projections()
{
	printf("\nLinearizing projection data...\n");

	//Check if the function was called from main
	bool called_from_main = (alg == 10);

	if (called_from_main)
	{
		mrcParser.load_original(filename);

		//Get the projection sizes and print
		pdim.x = mrcParser.dimensions(0);
		pdim.y = mrcParser.dimensions(1);
		pdim.z = mrcParser.dimensions(2);
		printf("%d projections of size: %d, %d loaded succesfully.\n", pdim.z, pdim.x, pdim.y);

		//Create CImgFloat to hold original projections on host
		h_proj_data = CImgFloat(pdim.x, pdim.y, pdim.z, 1, 0.0f);
		h_proj_data._data = mrcParser.getData();

		//Original projection data size
		data_size = h_proj_data.size() * sizeof(float);

		// Choose which GPU to run on, change this on a multi-GPU system.
		cudaStatus = cudaSetDevice(0);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaSetDevice failed:  Do you have a CUDA-capable GPU installed?\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// Allocate GPU original projection data 
		cudaStatus = cudaMalloc((void**)&d_proj_data, data_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// Copy projections to GPU
		cudaStatus = cudaMemcpy(d_proj_data, h_proj_data.data(), data_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Allocate host per_slice
		h_per_slice = new float[pdim.z];

		// Allocate GPU d_per_slice
		cudaStatus = cudaMalloc((void**)&d_per_slice, pdim.z * sizeof(float));
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	//Get maximum value
	i_0 = volume_max(d_proj_data, pdim);
	printf("i_0 = %f\n", i_0);

	//Block size
	dim3 blockDim = dim3(8, 8);

	float grid_x = ceil((float)pdim.x / 8.0f);
	float grid_y = ceil((float)pdim.y / 8.0f);
	dim3 gridDim = dim3(grid_x, grid_y);

	//Linearize each projection
	for (int i = 0; i < pdim.z; i++)
	{	

		linearize_projections_kernel<<<gridDim, blockDim>>>(d_proj_data + i*pdim.x*pdim.y);

		// Check for any errors launching the kernel
		cudaStatus = cudaGetLastError();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "linearize projcetions launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// cudaDeviceSynchronize waits for the kernel to finish, and returns
		// any errors encountered during the launch.
		cudaStatus = cudaDeviceSynchronize();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaDeviceSynchronize error after launching linearize projections kernel:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	//Update host projection data
	cudaStatus = cudaMemcpy(h_proj_data._data, d_proj_data, data_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "linearized projections cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}	

	if (called_from_main)
	{
		//Update filename
		filename.erase(filename.length() - 4); //Remove extension
		filename += "_linearized_" + to_string(i_0) + ".ali";

		//Save linearized projections		
		smrc(filename, h_proj_data._data, pdim, 0);
	}

	printf("Done!\n\n");
}

//For 'delinearizing' volumes
//Put volume filename in 'filename'
void delinearize_volume()
{
	printf("\nDelinearizing volume...\n");

	//Check if the function was called from main
	bool called_from_main = (alg == 11);

	if (called_from_main)
	{
		h_rec_vol.load(filename.c_str());

		//Original projection data size
		data_size = h_rec_vol.size() * sizeof(float);

		vdim.x = h_rec_vol._width;
		vdim.y = h_rec_vol._height;
		vdim.z = h_rec_vol._depth;

		printf("width: %i\n", vdim.x);
		printf("height: %i\n", vdim.y);
		printf("depth: %i\n", vdim.z);

		// Choose which GPU to run on, change this on a multi-GPU system.
		cudaStatus = cudaSetDevice(0);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaSetDevice failed:  Do you have a CUDA-capable GPU installed?\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// Allocate GPU data 
		cudaStatus = cudaMalloc((void**)&d_rec_vol, data_size);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// Copy to GPU
		cudaStatus = cudaMemcpy(d_rec_vol, h_rec_vol.data(), data_size, cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	printf("i_0 = %f\n", i_0);

	//Block size
	block = dim3(8, 8);

	float grid_x = ceil((float)h_rec_vol._width /block.x);
	float grid_y = ceil((float)h_rec_vol._height /block.y);
	dim3 gridDim = dim3(grid_x, grid_y);

	//Delinearize per slice
	for (int i = 0; i < vdim.z; i++)
	{

		delinearize_volume_kernel<<<gridDim, block>>>(d_rec_vol + i*vdim.x*vdim.y);

		// Check for any errors launching the kernel
		cudaStatus = cudaGetLastError();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "delinearize launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// cudaDeviceSynchronize waits for the kernel to finish, and returns
		// any errors encountered during the launch.
		cudaStatus = cudaDeviceSynchronize();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaDeviceSynchronize error after launching delinearize kernel:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	if (called_from_main)
	{
		//Copy result to host
		cudaStatus = cudaMemcpy(h_rec_vol._data, d_rec_vol, data_size, cudaMemcpyDeviceToHost);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "delinearize cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		//Save 
		filename.erase(filename.length() - 4); //Remove extension
		filename += "_delinearized_s" + to_string(i_0) + ".hdr";
		h_rec_vol.save_analyze(filename.c_str());
	}

	printf("Done!\n");
}

//For 'delinearizing' volumes
//Put volume filename in 'filename'
void delinearize_result_(CImgFloat &host_volume = h_rec_vol)
{	

	printf("\nDelinearizing volume...\n");

	printf("i_0 = %f\n", i_0);	

	//Volume is at h_rec_vol
	clear_device();	

	//Get dimensions
	vdim.x = host_volume.width();
	vdim.y = host_volume.height();
	vdim.z = host_volume.depth();

	//Volume GPU object (ONE SLICE)
	cudaStatus = cudaMalloc((void**)&d_rec_vol, vdim.x*vdim.y*sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "vol cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Non-tiled settings
	tiled = false;
	number_of_tiles = 1;
	current_tile = 0;
	tile_size = 0;
	number_extra_rows = 0;

	block = dim3(16, 8);
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y));
	CImgFloat delinearized = CImgFloat(vdim.x, vdim.y, vdim.z, 1, 0.0f);

	//Delinearize per slice
	for (int i = 0; i < vdim.z; i++)
	{
		//Copy original volume slice to GPU
		cudaStatus = cudaMemcpy(d_rec_vol, host_volume._data + i*vdim.y*vdim.x, vdim.x*vdim.y*sizeof(float), cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "vol. cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		delinearize_volume_kernel<<<BPgrid, block>>>(d_rec_vol);
		// Check for any errors launching the kernel
		cudaStatus = cudaGetLastError();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "delinearize launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// cudaDeviceSynchronize waits for the kernel to finish, and returns
		// any errors encountered during the launch.
		cudaStatus = cudaDeviceSynchronize();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaDeviceSynchronize error after launching delinearize kernel:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		cudaStatus = cudaMemcpy(delinearized._data + i*vdim.y*vdim.x, d_rec_vol, vdim.x*vdim.y*sizeof(float), cudaMemcpyDeviceToHost);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Error copying to delinearized:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	//Copy result to host
	host_volume = CImgFloat(delinearized);

	printf("Done!\n\n");
}


//Fit all the voxel values in 256 bins
//from 0 to 255
void histogram_equalization()
{
	h_rec_vol.load(filename.c_str());

	//Original projection data size
	data_size = h_rec_vol.size() * sizeof(float);

	vdim.x = h_rec_vol._width;
	vdim.y = h_rec_vol._height;
	vdim.z = h_rec_vol._depth;

	printf("width: %i\n", vdim.x);
	printf("height: %i\n", vdim.y);
	printf("depth: %i\n", vdim.z);

	h_per_slice = new float[vdim.z];

	// Choose which GPU to run on, change this on a multi-GPU system.
	cudaStatus = cudaSetDevice(0);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaSetDevice failed:  Do you have a CUDA-capable GPU installed?\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU volume
	cudaStatus = cudaMalloc((void**)&d_rec_vol, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU d_per_slice
	cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z*sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Copy volume to GPU
	cudaStatus = cudaMemcpy(d_rec_vol, h_rec_vol._data, data_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//To store histogram
	int* d_histogram;
	cudaMalloc((void**)&d_histogram, number_of_bins*sizeof(int));
	int* h_histogram = new int[number_of_bins];

	//Block size & grid size
	block = dim3(16, 8);
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), vdim.z);

	//Normalize to 0 - (number_of_bins-1) & round values to integer
	//Gets the rounded integer volume histogram (frequencies) at d_histogram
	volume_histogram(d_histogram);

	// Copy output histogram
	cudaStatus = cudaMemcpy(h_histogram, d_histogram, number_of_bins*sizeof(int), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying back histo!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//frequencies to probabilities
	float* histogram_probabilities = new float[number_of_bins];
	for (int i = 0; i < number_of_bins; i++)
	{
		histogram_probabilities[i] = (float)h_histogram[i] / (vdim.x*vdim.y*vdim.z);
	}

	//Cumulative probabilities
	float* cumulative_probabilities = new float[number_of_bins];
	cumulative_probabilities[0] = histogram_probabilities[0];
	for (int i = 1; i < number_of_bins; i++)
	{
		cumulative_probabilities[i] = cumulative_probabilities[i - 1] + histogram_probabilities[i];
	}

	//scale and floor
	for (int i = 0; i < number_of_bins; i++)
	{
		cumulative_probabilities[i] = 100.0*cumulative_probabilities[i];
	}

	float* d_cumulative_probabilities;
	cudaMalloc((void**)&d_cumulative_probabilities, number_of_bins*sizeof(int));

	//Copy cumulative probabilities to GPU
	cudaStatus = cudaMemcpy(d_cumulative_probabilities, cumulative_probabilities, number_of_bins*sizeof(float), cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying cumulative probabilities!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Lookup table style
	//Old values are the keys
	//The table is the scaled cumulative probabilities
	histogram_equalization(d_cumulative_probabilities);

	// Copy output 
	cudaStatus = cudaMemcpy(h_rec_vol._data, d_rec_vol, data_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying back volhisto. vol!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
	filename.erase(filename.end() - 4, filename.end());
	filename = filename + "_hist_eq_" + to_string(number_of_bins) + "bins.hdr";
	sv(filename.c_str());

	//Clear memory
	cudaFree(d_histogram);
	delete[] h_histogram;
	delete[] histogram_probabilities;
	delete[] cumulative_probabilities;
}

//Fit all the voxel values in 256 bins
void volume_histogram()
{
	h_rec_vol.load(filename.c_str());

	//Original projection data size
	data_size = h_rec_vol.size()*sizeof(float);

	vdim.x = h_rec_vol._width;
	vdim.y = h_rec_vol._height;
	vdim.z = h_rec_vol._depth;

	printf("width: %i\n", vdim.x);
	printf("height: %i\n", vdim.y);
	printf("depth: %i\n", vdim.z);

	h_per_slice = new float[vdim.z];

	// Choose which GPU to run on, change this on a multi-GPU system.
	cudaStatus = cudaSetDevice(0);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaSetDevice failed:  Do you have a CUDA-capable GPU installed?\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU volume
	cudaStatus = cudaMalloc((void**)&d_rec_vol, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU d_per_slice
	cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z * sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Copy volume to GPU
	cudaStatus = cudaMemcpy(d_rec_vol, h_rec_vol._data, data_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//To store histogram
	int* d_histogram;
	cudaMalloc((void**)&d_histogram, number_of_bins * sizeof(int));
	int* h_histogram = new int[number_of_bins];

	//Block size & grid size
	block = dim3(16, 8);
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), vdim.z);

	//Normalize to 0 - (number_of_bins-1) & round values to integer
	//Gets the rounded integer volume histogram (frequencies) at d_histogram
	//Get max
	float max = volume_max(d_rec_vol);

	//Get min
	float min = volume_min(d_rec_vol);

	printf("max, min: %f, %f\n", max, min);

	//For each voxel
	//v = scale*(v - min / max - min)
	volume_histogram_kernel <<<BPgrid, block>>> (d_rec_vol, max, min, d_histogram);
	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "normalize_volume_intensity kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching normalize_volume_intensity kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Copy output histogram
	cudaStatus = cudaMemcpy(h_histogram, d_histogram, number_of_bins * sizeof(int), cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying back histo!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Create file
	std::ofstream file;
	filename = "histogram_" + filename;
	filename.erase(filename.end() - 4, filename.end());
	filename = filename + ".txt";
	file.open(filename.c_str());

	//Write max and min
	file << "Max: " << to_string(max) << std::endl;
	file << "Min: " << to_string(min) << std::endl;

	float step = (max - min) / number_of_bins;

	//Write histogram
	for (int i = 0; i < number_of_bins; i++)
	{
		file << to_string(min + (i+1)*step) << "," << to_string(h_histogram[i]) << std::endl;
	}

	file.close();
}

//Load a mask for each projection
//Set all fiducials and triangles to 0, the rest to 1
//Multiply the projection data with the masks and save
void mask_projections(string filename)
{
	//Load projection data
	mrcParser.load_original(filename);

	//Get the projection sizes and print
	pdim.x = mrcParser.dimensions(0);
	pdim.y = mrcParser.dimensions(1);
	pdim.z = mrcParser.dimensions(2);
	printf("%d projections of size: %d, %d loaded succesfully.\n", pdim.z, pdim.x, pdim.y);

	//Used in several kernels
	vdim = pdim;

	data_size = pdim.x*pdim.y*pdim.z * sizeof(float);

	//Create CImgFloat to hold original projections on host
	h_proj_data = CImgFloat(pdim.x, pdim.y, pdim.z, 1, 0.0f);
	h_proj_data._data = mrcParser.getData();

	//Load projection data to GPU
	cudaStatus = cudaMalloc((void**)&d_proj_data, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	cudaStatus = cudaMemcpy(d_proj_data, h_proj_data._data, data_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Load the masks
	float* d_masks;
	cudaStatus = cudaMalloc((void**)&d_masks, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "masks cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	CImgFloat mask;
	for (int i = 0; i < pdim.z; i++)
	{
		//Generate filename
		string mask_filename = "fiducials/ts_16_";
		//string mask_filename = "fiducials_and_triangles/ts_1_";
		if (i < 10)
			mask_filename = mask_filename + "0";
		mask_filename = mask_filename + to_string(i) + ".bmp";

		printf("Loading %s\n", mask_filename.c_str());

		//Load mask and rotate 90 vertically
		mask.load_bmp(mask_filename.c_str());
		mask.mirror('y');

		cudaStatus = cudaMemcpy(d_masks + i*pdim.y*pdim.x, mask._data, pdim.x*pdim.y*sizeof(float), cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "masks cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}

	block = dim3(16, 8); //General block dimensions
	FPgrid = dim3(ceil((float)pdim.x/block.x), ceil((float)pdim.y/block.y), vdim.z);

	mask_projections_kernel<<<FPgrid, block>>>(d_proj_data, d_masks);

	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "mask projections kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching mask projections kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}	

	h_per_slice = new float[vdim.z];

	// Allocate GPU d_per_slice
	cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z*sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Get min, max and mean
	float min, max, mean;
	min = volume_min(d_proj_data);
	max = volume_max(d_proj_data);
	mean = volume_mean(d_proj_data);

	printf("mmm: %f, %f, %f\n", max, min, mean);

	//Copy back result
	cudaStatus = cudaMemcpy(h_proj_data._data, d_proj_data, data_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "retrieving projections cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Save masked projections
	filename.erase(filename.end() - 4, filename.end());
	filename = filename + "_masked.ali";
	smrc(filename, h_proj_data._data, pdim, 0, min, max, mean);
}

//Save the volume as a bunch of
//2D images (XY view)
//If step is > 1, some images will be skipped
//E.g. if step = 5, images 0, 5, ... will be saved
//Use number_of_tiles to set the step. Set tiled to false if no step is required.
void volume_to_images(int step = 1)
{
	//Load volume
	h_rec_vol.load_analyze(filename.c_str());

	//Get volume dimensions
	vdim = make_uint3(h_rec_vol._width, h_rec_vol._height, h_rec_vol._depth);

	//Size of volume data
	recon_size = vdim.x*vdim.y*vdim.z * sizeof(float);

	//Allocate for min, max, etc
	h_per_slice = new float[vdim.z];

	//Block and grid dimensions
	block = dim3(16, 8);
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), vdim.z); 

	// Allocate GPU d_per_slice
	cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z * sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Allocate gpu volume
	cudaStatus = cudaMalloc((void**)&d_rec_vol, recon_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume malloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Copy volume to GPU
	cudaMemcpy(d_rec_vol, h_rec_vol._data, recon_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "volume cudaMemCpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Normalize volume intensity between 0 - 255
	normalize_volume_intensity(d_rec_vol, 255);

	//Cut extension from filename
	filename.erase(filename.end() - 4, filename.end());

	//Store each slice as .bmp
	CImgFloat image = CImgFloat(vdim.x, vdim.y, 1, 1, 0.0f);
	for (int i = 0; i < vdim.z; i+= step)
	{
		printf("\r %i/%i", i+1, vdim.z);
		//Copy slice
		cudaMemcpy(image._data, d_rec_vol + i*vdim.x*vdim.y, vdim.x*vdim.y * sizeof(float), cudaMemcpyDeviceToHost);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "slice cudaMemCpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		string fname = "images/" + filename + "_";
		if (i < 10)
			fname += "00";
		else if (i < 100)
			fname += "0";
		fname += to_string(i) + ".bmp";

		//Flip image vertically
		image.mirror('y');

		//Save slice
		image.save_bmp(fname.c_str());
	}

	clear_device();

	exit(0);
}

//Crops the final volume and applies gamma correction 0.7
//Then saves it
void crop_result(CImgFloat &host_volume = h_rec_vol)
{
	printf("\nCropping result...\n");
	
	clear_device();

	//Original dimensions
	uint3 odim;
	odim.x = host_volume.width();
	odim.y = host_volume.height();
	odim.z = host_volume.depth();
	printf("padded dim: %d, %d, %d\n", odim.x, odim.y, odim.z);

	//Original volume GPU object (One XY slice)
	cudaStatus = cudaMalloc((void**)&d_rec_vol, odim.x*odim.y*sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "original vol cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Non-tiled settings
	tiled = false;
	number_of_tiles = 1;
	current_tile = 0;
	tile_size = 0;
	number_extra_rows = 0;

	//New dimensions
	vdim = odim;
	if (pdim.x != 0)
		vdim.x = pdim.x;
	else
		vdim.x = 1024;
	printf("cropped dim: %d, %d, %d\n", vdim.x, vdim.y, vdim.z);

	//Cropped volume GPU object (ONE SLICE)
	cudaStatus = cudaMalloc((void**)&d_rec_vol_old, vdim.x*vdim.y* sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cropped vol cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	padding = (odim.x - vdim.x)/2;
	printf("padding: %d\n", padding);

	block = dim3(16, 8); 
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), 1);
	CImgFloat cropped = CImgFloat(vdim.x, vdim.y, vdim.z, 1, 0.0f);

	//Crop volume slice by slice (To be hable to handle big volumes!)
	for (int slice = 0; slice < odim.z; slice++)
	{
		//Copy original volume slice to GPU
		cudaStatus = cudaMemcpy(d_rec_vol, host_volume._data + slice*odim.y*odim.x, odim.x*odim.y*sizeof(float), cudaMemcpyHostToDevice);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "original vol. cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		crop_result_kernel<<<BPgrid, block >>>(d_rec_vol, d_rec_vol_old, odim, vdim);

		// Check for any errors launching the kernel
		cudaStatus = cudaGetLastError();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "crop vol kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		// cudaDeviceSynchronize waits for the kernel to finish, and returns
		// any errors encountered during the launch.
		cudaStatus = cudaDeviceSynchronize();
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "cudaDeviceSynchronize error after launching crop vol kernel:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}

		cudaStatus = cudaMemcpy(cropped._data + slice*vdim.y*vdim.x, d_rec_vol_old, vdim.x*vdim.y*sizeof(float), cudaMemcpyDeviceToHost);
		if (cudaStatus != cudaSuccess) {
			fprintf(stderr, "Error copying to h_per_slice:\n%s\n", cudaGetErrorString(cudaStatus));
			error();
		}
	}	

	//Copy result to host
	host_volume = CImgFloat(cropped);

	printf("Done!\n");
}

void substract_volumes(const float* d_vol1, const float* d_vol2, float* d_dst)
{

	substract_volumes_kernel<<<BPgrid, block >>>(d_vol1, d_vol2, d_dst);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Substract kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching substract kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void add_volumes(const float* d_vol1, const float* d_vol2, float* d_dst)
{

	add_volumes_kernel<<<BPgrid, block>>>(d_vol1, d_vol2, d_dst);

	// Check for any errors launching the kernel
	cudaStatus = cudaGetLastError();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "Add kernel launch failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// cudaDeviceSynchronize waits for the kernel to finish, and returns
	// any errors encountered during the launch.
	cudaStatus = cudaDeviceSynchronize();
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaDeviceSynchronize error after launching add kernel:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}
}

void normalize_volume_zero_one(float normalize_max = 1)
{
	h_rec_vol.load_analyze(filename.c_str());

	//Original projection data size
	data_size = h_rec_vol.size() * sizeof(float);

	vdim.x = h_rec_vol._width;
	vdim.y = h_rec_vol._height;
	vdim.z = h_rec_vol._depth;

	printf("width: %i\n", vdim.x);
	printf("height: %i\n", vdim.y);
	printf("depth: %i\n", vdim.z);

	h_per_slice = new float[vdim.z];

	// Choose which GPU to run on, change this on a multi-GPU system.
	cudaStatus = cudaSetDevice(0);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaSetDevice failed:  Do you have a CUDA-capable GPU installed?\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU volume
	cudaStatus = cudaMalloc((void**)&d_rec_vol, data_size);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Allocate GPU d_per_slice
	cudaStatus = cudaMalloc((void**)&d_per_slice, vdim.z * sizeof(float));
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "projections cudaMalloc failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	// Copy volume to GPU
	cudaStatus = cudaMemcpy(d_rec_vol, h_rec_vol._data, data_size, cudaMemcpyHostToDevice);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "proj. data cudaMemcpy failed:\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	//Block size & grid size
	block = dim3(16, 8);
	BPgrid = dim3(ceil((float)vdim.x / block.x), ceil((float)vdim.y / block.y), vdim.z);

	//For each voxel
	//v = scale*(v - min / max - min)
	normalize_volume_intensity(d_rec_vol, normalize_max);

	//Copy result back
	cudaStatus = cudaMemcpy(h_rec_vol._data, d_rec_vol, data_size, cudaMemcpyDeviceToHost);
	if (cudaStatus != cudaSuccess) {
		fprintf(stderr, "cudaMemcpy failed when copying back result!\n%s\n", cudaGetErrorString(cudaStatus));
		error();
	}

	h_rec_vol.save_analyze(string("normalized_" + filename).c_str());
}


//Read text file with list of angles
void read_tlt()
{
	std::ifstream file;

	file.open(angles_list_filename.c_str());
	if (!file) {
		printf("Unable to open splat kernel file!\n");
		error();
	}

	float angle;
	while (file >> angle)
	{		
		angles_list.push_back(angle);
	}

	if (angles_list.size() != pdim.z)
	{
		printf("The lenght of tilt angles file and number of projections are not the same!");
		error();
	}
	else
	{
		printf("Loaded tilt angle file.\n");
	}

	file.close();
}