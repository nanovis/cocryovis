#!/bin/bash
set -euo pipefail

cd ./modules/Proximal_CryoET/CUDA_PROXIMAL_SART
rm -r -f ./build

if [ -x /usr/bin/gcc-12 ]; then
    export CC=/usr/bin/gcc-12
    export CXX=/usr/bin/g++-12
    export CUDAHOSTCXX=/usr/bin/g++-12
elif [ -x /usr/bin/gcc-11 ]; then
    export CC=/usr/bin/gcc-11
    export CXX=/usr/bin/g++-11
    export CUDAHOSTCXX=/usr/bin/g++-11
else
    echo "No supported GCC version (11 or 12) found."
    exit 1
fi

cmake -S ./ -B ./build
cd build
make