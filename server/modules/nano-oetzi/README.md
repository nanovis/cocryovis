# Finding Nano-Ötzi: Cryo-Electron Tomography Visualization Guided by Learned Segmentation
This repository contains code for training and inference of volumes with use of deep segmentation model presented in Nano-Oetzi paper.

You need to have `cuda 11.0` and `python 3.8` installed. You might have problems setting-up the environment with different versions.

The easiest is to set-up a conda virtual environment using `requirements.txt` file from the repository.
```
Use conda to create a new environment with python 3.8 and install all packages in requirements.txt using `pip` command.
```
Once activating the environment:
```
conda activate <path_to_environment>
```
The environment should be ready to use.

## Overview:
### External tools:
For training and inference the data needs to be converted to torchvtk format. We provide tools to convert the MRC volumes into torchvtk.
```
segmentation/conversion/                 # Script and Docs to convert .mrc to torchvtk format
segmentation/iunets/                     # UNet and iUNet models, from https://github.com/cetmann/iunets
```

### Inference script:
Script that performs all the steps needed for inference with the pretrained model on MRC or RAW+JSON volume (splitting into chunks, running inference on them, stitching the inference results into output volumes).
```
segmentation\inference_script.py        # Script for automatic inference with a pretrained model
```
Example use:
```
python inference_script.py <path_to_mrc_or_json_volume_file> <output_directory_path> [-v -c]
```

### Training and test scripts:
The scripts enable training the model with or without GPU. The model training depends on the dataset size. In our case we used 60 volumes: 50 for training, 5 for validation, and 5 for testing. The model training took 5 days and 16 hours to converge. The fine-tuning of the selected transfer-learned model took an additional 2 days and 15 hours. The volumes resolution was: 1024x1440x\[227-500\]
```
segmentation/train.py                    # Script to start training for foreground - background data. See --help for arguments
segmentation/lmodule.py                  # Script with the Lightning Module. Implements training for foreground - background data procedure
segmentation/test.py                     # Script to start testing for foreground - background data
segmentation/train_gpus.py               # Script to start training for foreground - background data with many GPUs. See --help for arguments
segmentation/lmodule_gpus.py             # Script with the Lightning Module. Implements training on many GPUs for foreground - background data procedure

segmentation/transfer.py                 # Script to start training for many classes data. See --help for arguments
segmentation/lmodule_transfer.py         # Script with the Lightning Module. Implements training for many classes data procedure
segmentation/test_transfer.py            # Script to start testing for many classes data
segmentation/transfer_gpus.py            # Script to start training for many classes data data with many GPUs. See --help for arguments
segmentation/lmodule_transfer_gpus.py    # Script with the Lightning Module. Implements training on many GPUs for many classes data procedure
```

### Support scripts and files
Our volumes were to big to use them for training as a whole. We needed to split them into chunk of resolution 512x512x\[227-500\].
```
segmentation/split.py                       # Script for splitting data into 9 chunks
segmentation/check_data.py                  # Checks the data consistency and normalizes the chunks
segmentation/rename_files.py                # Script for batch renaming chunk files and prepare them for stitching
segmentation/stitch.py                      # Script for stiching chunks into full volume.

conda_env.yaml                              # Docs listing the necessary py packages to run these scripts.
```

## Set up and running scripts
### Split volume
Splits volume into individual chunks of size depth x 512 x 512 voxels, where depth needs to be less than 512 voxels
```
python ./split.py <input_mrc_or_json_volume_file> <chunks_output_folder>
```
### Normalize
Checks if split data is correctly bundeled and normalizes the data within chunks for F-B segmentation:
```
python ./check_data.py <folder_with_chunks> <normalized_chunks_output_folder>
```

### Foreground-background training
Run train script from `segmentation` folder.
```
train.py <path_to_train_data_folder> --run_id <run_id_for_logging> --max_epochs <number_of_epochs>
```

### 4-class transfer learning
Run transfer script from `segmentation` folder.
```
transfer.py <path_to_train_data_folder> --run_id <run_id_for_logging> --pretrained <path_to_pretrained_foreground-background_checkpoint_file> --max_epochs <number_of_epochs>
```

### Manual inference
Run script from `segmentation` folder.
```
python test_transfer.py <folder_with_normalized_chunks> --checkpoint <path_to_model_file> --output_path <predictions_output_folder>
```

### Stitch chunks
The script stitches prediction chunks into output volumes (check inferece_script.py for more details):
```
python ./stitch.py <prediction_folder> <tile_location_prefix> <output_files_prefix>
```

## Pretrained models
```
models/foreground_background_model.ckpt: Pretrained model for foreground-background segmentation
models/four_classes_model.ckpt: Pretrained model for four classes segmentation
```

## Sample raw microscopy input data
An example raw input data volume is available in the Electron Microscopy Data Bank under ID EMD-33297.  
https://www.ebi.ac.uk/emdb/EMD-33297


## Sample annotation and prediction data
The manual annotation data for the above volume and the 4-class segmentation data is available in KAUST Repository.  
https://repository.kaust.edu.sa/handle/10754/676709

## Visualization
The visualization pipeline is available as a WebGPU implementation in a separate repository.  
https://github.com/nanovis/nano-oetzi-webgpu

## Citation
```bibtex
@article{Nguyen_Bohak_2022,
  author = {Nguyen, Ngan and Bohak, Ciril and Engel, Dominik and Mindek, Peter and Strnad, Ondrej and Wonka, Peter and Li, Sai and Ropinski, Timo and Viola, Ivan},
  journal = {IEEE Transactions on Visualization and Computer Graphics}, 
  title = {Finding Nano-Ötzi: Cryo-Electron Tomography Visualization Guided by Learned Segmentation}, 
  year = {2022},
  pages = {1-18},
  doi = {10.1109/TVCG.2022.3186146}
}
```
