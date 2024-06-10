# vol-web-server

## Environment
To be able to run certain server side processes, you need to setup the environment and applications. There are two applications in question: (1) [Ilastik](https://www.ilastik.org), and (2) [Nano-Ötzi](https://github.com/nanovis/nano-oetzi).

The conda environment packages are listed in ```conda-packages.txt``` file and include packages needed for both server side applications.

The Nano-Ötzi requires CUDA Toolkit. It was tested with 11.3, 11.6, and 11.7. One needs to use appropriate PyTorch as well.

## Folder structure
The system consists of several components and the overall folder structure we use is this:
```
.
├── ilastik -> ilastik-1.4.0b21-gpu-Linux
├── ilastik-1.4.0b21-gpu-Linux
├── models
├── nano-oetzi
└── vol-web-server
```

## Setup
To install the app, you need node.js. In the project folder run:

```npm install```

To run the server run:

```nodemon index.mjs```

## Ilastik
The Ilastik used in our setup is standard Ilastik version with adapted script for headless operation which was provided to us by the Ilastik developer.

The package can be extracted from a zip and linked to desired path location.

## Nano-Ötzi
We use a version form the repository. To make it run the environment needs to be set-up correctly.