#!/bin/sh

mkdir -p ./modules/ilastik
pip3 install gdown && gdown "https://drive.google.com/uc?id=1UqbeQGYrCOoe30u0z9qMFXto9tVTPPuw" -O modules/ilastik/ilastik-1.4.0b21-gpu-Linux.tar.bz2
tar -xvf modules/ilastik/ilastik-1.4.0b21-gpu-Linux.tar.bz2 -C modules/ilastik
mv modules/ilastik/ilastik-1.4.0b21-gpu-Linux modules/ilastik/ilastik
rm modules/ilastik/ilastik-1.4.0b21-gpu-Linux.tar.bz2