#!/bin/bash

cd modules/imod
# Download and install IMOD
wget -q https://bio3d.colorado.edu/imod/AMD64-RHEL5/imod_5.1.1_RHEL8-64_CUDA12.0.sh && chmod +x imod_5.1.1_RHEL8-64_CUDA12.0.sh && sh ./imod_5.1.1_RHEL8-64_CUDA12.0.sh -y -dir ./ && rm imod_5.1.1_RHEL8-64_CUDA12.0.sh

