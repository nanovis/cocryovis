#!/bin/bash
set -euo pipefail

# Set script root to its directory
cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit

CUDA_VERSION="11.8.0"
ENVIRONMENT_PATH="../.venv"

# Clean
rm -rf $ENVIRONMENT_PATH

# Create virtual environment
conda create -p $ENVIRONMENT_PATH python=3.8 -y

# Install requirements
conda run --no-capture-output -p $ENVIRONMENT_PATH pip install -r ./requirements.txt