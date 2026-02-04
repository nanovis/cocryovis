import os
from argparse import ArgumentParser
from typing import Tuple, List

import h5py
import numpy as np

Dimensions = Tuple[int, int, int]


def labels_to_h5(label_paths: List[str], output_path: str, dataset_name: str, dimensions: Dimensions, log=True):
    label_datasets = []
    for label_path in label_paths:
        np_data = np.fromfile(label_path, dtype=np.uint8,
                              count=dimensions[0] * dimensions[1] * dimensions[2])
        np_data = np.reshape(np_data, [
            dimensions[2],
            dimensions[1],
            dimensions[0]
        ])
        label_datasets.append(np_data)

    labels = np.zeros((dimensions[2], dimensions[1], dimensions[0]), dtype=np.uint8)
    maximums = np.zeros((dimensions[2], dimensions[1], dimensions[0]), dtype=np.uint8)
    for i, label_dataset in enumerate(label_datasets, start=1):
        mask = label_dataset > maximums
        maximums[mask] = label_dataset[mask]
        labels[mask] = i

    if log:
        values, counts = np.unique(labels, return_counts=True)
        print(f"Labels merged.\nLabel indices in resulting file: {values}\nLabel counts in resulting file: {counts}")

    directory = os.path.dirname(output_path)
    os.makedirs(directory, exist_ok=True)
    with h5py.File(output_path, 'w') as file:
        file.create_dataset(dataset_name, data=labels, chunks=True)


if __name__ == '__main__':
    parser = ArgumentParser('Convert label volumes to h5 label dataset')
    parser.add_argument('-l', '--labels', type=str, nargs='+', required=True,
                        help='Paths to labels.')
    parser.add_argument('-d', '--dimensions', required=True, type=str, help='Dimensions presented as XxYxZ.')
    parser.add_argument('-s', '--datasetName', type=str, required=True, help='Name of the dataset within the file.')
    parser.add_argument('-o', '--output', type=str, required=True, help='Path to output file')
    parser.add_argument('-log', type=bool, default=True, help='Output the process status.')
    args = parser.parse_args()

    parsed_dims = tuple([int(d) for d in args.dimensions.split('x')])
    if len(parsed_dims) != 3:
        raise Exception("Dimension parameter is in an incorrect format.")

    dims: Dimensions = (parsed_dims[0], parsed_dims[1], parsed_dims[2])

    labels_to_h5(args.labels, args.output, args.datasetName, dims, args.log)
