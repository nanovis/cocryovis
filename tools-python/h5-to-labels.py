import os
from argparse import ArgumentParser
from pathlib import Path

import h5py


def h5_to_labels(label_path: str, dataset_name: str, output_dir: str):

    with h5py.File(label_path, 'r') as file:
        data = file[dataset_name]

        output_file_name = Path(label_path).stem
        for i in range(data.shape[3]):
            label_data = data[:, :, :, i]
            label_data.tofile(os.path.join(output_dir, f'{output_file_name}_label_{i}.raw'))

if __name__ == '__main__':
    parser = ArgumentParser('Convert h5 label dataset to raw volumes')
    parser.add_argument('-l', '--labels', type=str, required=True, help='Path to labels.')
    parser.add_argument('-s', '--datasetName', type=str, required=True, help='Name of the dataset within the file.')
    parser.add_argument('-o', '--outputDir', type=str, required=True, help='Path to output directory')
    args = parser.parse_args()

    h5_to_labels(args.labels, args.datasetName, args.outputDir)
