#!/bin/bash
set -e

if [ -z "$CUDA_HOME" ]; then
  echo "Error: CUDA_HOME is not set. Please set CUDA_HOME to your CUDA installation directory."
  exit 1
fi

cd ./modules/gctffind
make clean || true
make exe -f makefile CUDAHOME=$CUDA_HOME