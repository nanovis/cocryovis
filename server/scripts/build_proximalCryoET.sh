#!/bin/bash
set -euo pipefail

# Set script root to its directory
cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit

CUDA_ARCHITECTURES="native"

while [[ $# -gt 0 ]]; do
  case $1 in
    --cuda-architectures)
      CUDA_ARCHITECTURES="$2"
      shift 2
      ;;
    *)
      # Legacy positional argument support
      CUDA_ARCHITECTURES="$1"
      shift
      ;;
  esac
done

cd ../modules/Proximal_CryoET/CUDA_PROXIMAL_SART
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

cmake -S ./ -B ./build -DCUDA_ARCHITECTURES="${CUDA_ARCHITECTURES}"
cd build
make