# vol-web-server

## Environment
To be able to run certain server side processes, you need to setup the environment and applications. There are two applications in question: (1) [Ilastik](https://www.ilastik.org), and (2) [Nano-Ötzi](https://github.com/nanovis/nano-oetzi).
Nano-Ötzi is included as a submodule, while you can install the required version of Ilastik with ```install_ilastik.sh``` shell script.

The packages are listed in ```requirements.txt``` file.

Several modules require CUDA Toolkit. The project was tested on 12.4.
Proximal CryoET requires CMake 3.24 to build.

## Setup
Make sure submodules are installed by running ```git pull --recurse-submodules```

Download Ilastik by running ```./install_ilastik.sh```

Build submodules by running ```./install_submodules.sh```

Install python packages via ```pip install -r requirements.txt```

In the root folder create a ```.env``` file with the following entries or add them to the local environment:
```
# Path to main sqlite database
DATABASE_URL=file:./db.sqlite

# Secret used to sign the session cookie
SESSION_SECRET=

# Admin Credentials
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

To install the app, you need node.js. In the project folder run:

```npm install```

To setup the database run:

```npm run prisma:init```

To setup the client run:

```./build_client.sh```

To run the server run:

```npm start```

## Ilastik
The Ilastik used in our setup is standard Ilastik version with adapted script for headless operation which was provided to us by the Ilastik developer.