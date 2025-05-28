#!/bin/bash
set -e

IMOD_INSTALLER="imod_5.1.1_RHEL8-64_CUDA12.0.sh"
IMOD_URL="https://bio3d.colorado.edu/imod/AMD64-RHEL5/${IMOD_INSTALLER}"

mkdir -p ./modules/imod
cd ./modules/imod
find ./ -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +

wget -q "${IMOD_URL}"

chmod +x "${IMOD_INSTALLER}"
sh "./${IMOD_INSTALLER}" -y -skip -dir ./

rm -f "${IMOD_INSTALLER}"

chmod +x "./IMOD/IMOD-linux.sh"
sh "./IMOD/IMOD-linux.sh"