#!/bin/bash
set -e

cd ./modules/Proximal_CryoET/CUDA_PROXIMAL_SART
rm -r -f ./build

# Force correct compiler for CUDA
export CC=/usr/bin/gcc-12
export CXX=/usr/bin/g++-12
export CUDAHOSTCXX=/usr/bin/g++-12

cmake -S ./ -B ./build
cd build
make