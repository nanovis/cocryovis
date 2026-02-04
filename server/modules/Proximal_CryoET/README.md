**Publication**: [GPU Accelerated 3D Tomographic Reconstruction and Visualization from Noisy Electron Microscopy Tilt-Series](https://ieeexplore.ieee.org/document/9992117)

**Supplementary Webpage** (Abstract, demo video, binaries): https://juareyra.github.io/Proximal_cryo-ET_supplementary/

#### **Build using CMake on Windows**

* Tested on Windows 10 x64 with CUDA Toolkit 11.3 and Visual Studio Community 2017

* Open CMake GUI

* Set source to ../Proximal_CryoET/CUDA_PROXIMAL_SART

* Set build path to ../Proximal_CryoET/CUDA_PROXIMAL_SART/build

* Click configure, set configuration as in the image below and press finish

  ![](images/configure.png)

* Click 'Generate', then 'Open project'

* Build Solution from MS Visual Studio Community



#### **Build using CMake on Linux**

* Tested on Linux Mint 20.1 using CUDA Toolkit 11.2

* Clone/Download the repo

* Open a terminal and go to ../Proximal_CryoET/CUDA_PROXIMAL_SART

* Then, execute the following commands:

  ```
  cmake -S ./ -B ./build
  cd build
  make
  ```

  

  
