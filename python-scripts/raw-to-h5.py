import os
from argparse import ArgumentParser
from typing import Tuple

import h5py
import numpy as np

Dimensions = Tuple[int, int, int]


def raw_to_h5(raw_file_path: str, output_path: str, dataset_name: str, dimensions: Dimensions, log=True):
    np_data = np.fromfile(raw_file_path, dtype=np.uint8,
                          count=dimensions[0] * dimensions[1] * dimensions[2])

    np_data = np.reshape(np_data, [
        dimensions[2],
        dimensions[1],
        dimensions[0]
    ])

    directory = os.path.dirname(output_path)
    os.makedirs(directory, exist_ok=True)
    with h5py.File(output_path, 'w') as file:
        file.create_dataset(dataset_name, data=np_data)


if __name__ == '__main__':
    parser = ArgumentParser('Convert raw volume to h5 dataset')
    parser.add_argument('-r', '--raw', required=True, type=str, help='Path to training configuration file.')
    parser.add_argument('-d', '--dimensions', required=True, type=str, help='Dimensions presented as XxYxZ.')
    parser.add_argument('-s', '--datasetName', type=str, required=True, help='Name of the dataset within the file.')
    parser.add_argument('-o', '--output', type=str, required=True, help='Path to output file')
    parser.add_argument('-log', type=bool, default=True, help='Output the process status.')
    args = parser.parse_args()

    parsed_dims = tuple([int(d) for d in args.dimensions.split('x')])
    if len(parsed_dims) != 3:
        raise Exception("Dimension parameter is in an incorrect format.")

    dims: Dimensions = (parsed_dims[0], parsed_dims[1], parsed_dims[2])

    raw_to_h5(args.raw, args.output, args.datasetName, dims, args.log)
