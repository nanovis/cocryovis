#!/bin/bash
set -e

ls
cd ./modules/Proximal_CryoET/CUDA_PROXIMAL_SART
rm -r -f ./build

cmake -S ./ -B ./build
cd build
make