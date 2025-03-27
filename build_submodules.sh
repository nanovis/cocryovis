#!/bin/bash

# Save the current directory
original_dir=$(pwd)

# Proximal CryoET
cd ./modules/Proximal_CryoET/CUDA_PROXIMAL_SART
cmake -S ./ -B ./build
cd build
make

# Change back to the original directory
cd $original_dir
