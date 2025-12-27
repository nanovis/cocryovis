#!/bin/bash
set -e

IMOD_INSTALLER="imod_5.1.1_RHEL8-64_CUDA12.0.sh"
IMOD_URL="https://bio3d.colorado.edu/imod/AMD64-RHEL5/${IMOD_INSTALLER}"

mkdir -p ./modules/imod
cd ./modules/imod
find ./ -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +

echo "Downloading IMOD installer from ${IMOD_URL}..."
wget --no-check-certificate "${IMOD_URL}"

echo "Installing IMOD..."
chmod +x "${IMOD_INSTALLER}"
sh "./${IMOD_INSTALLER}" -y -skip -dir ./

rm -f "${IMOD_INSTALLER}"