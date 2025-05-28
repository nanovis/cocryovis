#!/bin/bash
set -e

mkdir -p ./modules/ilastik
cd ./modules/ilastik

# Exit early if run_ilastik.sh already exists
if [ -f "run_ilastik.sh" ]; then
  echo "run_ilastik.sh already exists. Skipping download and extraction."
  exit 0
fi

find ./ -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} + 2>/dev/null || true

# Create virtual environment if not exists
if [ ! -d "./venv" ]; then
  python3 -m venv ./venv
fi

# Activate virtual environment and install gdown if needed
. ./venv/bin/activate
pip install --upgrade pip
pip install --upgrade gdown

echo "Downloading ilastik-1.4.0b21-gpu-Linux.tar.bz2..."
gdown 1UqbeQGYrCOoe30u0z9qMFXto9tVTPPuw -O ilastik-1.4.0b21-gpu-Linux.tar.bz2

deactivate
rm -rf ./venv

echo "Extracting ilastik-1.4.0b21-gpu-Linux.tar.bz2..."
mkdir -p ./extracted
tar -xf ./ilastik-1.4.0b21-gpu-Linux.tar.bz2 -C ./extracted

mv ./extracted/*/* ./

rm -rf ./extracted
rm ./ilastik-1.4.0b21-gpu-Linux.tar.bz2
