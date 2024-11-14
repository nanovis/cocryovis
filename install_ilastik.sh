#!/bin/sh

mkdir -p ./modules
pip3 install gdown && gdown "https://drive.google.com/uc?id=1UqbeQGYrCOoe30u0z9qMFXto9tVTPPuw" -O modules/ilastik-1.4.0b21-gpu-Linux.tar.bz2
tar -xvf modules/ilastik-1.4.0b21-gpu-Linux.tar.bz2 -C modules
mv modules/ilastik-1.4.0b21-gpu-Linux modules/ilastik
rm modules/ilastik-1.4.0b21-gpu-Linux.tar.bz2