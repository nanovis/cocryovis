#!/bin/bash
set -e

cd ./modules/Proximal_CryoET/CUDA_PROXIMAL_SART
rm -r -f ./build

cmake -S ./ -B ./build
cd build
make