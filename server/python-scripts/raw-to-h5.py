import os
import sys
from argparse import ArgumentParser
from typing import Tuple

import h5py
import numpy as np

Dimensions = Tuple[int, int, int]


def raw_to_h5(raw_file_path: str, output_path: str, dataset_name: str,
              dimensions: Dimensions, usedBits: int, isSigned: bool,
              littleEndian: bool):

    if usedBits == 8:
        if isSigned:
            datatype = np.int8
        else:
            datatype = np.uint8
    elif usedBits == 16:
        if isSigned:
            datatype = np.int16
        else:
            datatype = np.uint16
    elif usedBits == 32:
        if isSigned:
            datatype = np.int32
        else:
            datatype = np.uint32
    elif usedBits == 64:
        if isSigned:
            datatype = np.int64
        else:
            datatype = np.uint64
    else:
        raise Exception("Unsupported data format!")

    full_datatype = np.dtype(datatype)
    if usedBits > 8:
        byte_order = '<' if littleEndian else '>'
        full_datatype = np.dtype(byte_order + full_datatype.char)

    np_data = np.fromfile(raw_file_path,
                          dtype=full_datatype,
                          count=dimensions[0] * dimensions[1] * dimensions[2])

    np_data = np.reshape(np_data,
                         [dimensions[2], dimensions[1], dimensions[0]])

    if usedBits > 8 and ((littleEndian and sys.byteorder == 'big') or
                         (not littleEndian and sys.byteorder == 'little')):
        np_data = np_data.newbyteorder().byteswap(inplace=True)

    directory = os.path.dirname(output_path)
    os.makedirs(directory, exist_ok=True)
    with h5py.File(output_path, 'w') as file:
        file.create_dataset(dataset_name, data=np_data, chunks=True)


if __name__ == '__main__':
    parser = ArgumentParser('Convert raw volume to h5 dataset')
    parser.add_argument('-r',
                        '--raw',
                        required=True,
                        type=str,
                        help='Path to training configuration file.')
    parser.add_argument('-d',
                        '--dimensions',
                        required=True,
                        type=str,
                        help='Dimensions presented as XxYxZ.')
    parser.add_argument('-b',
                        '--usedBits',
                        required=True,
                        type=int,
                        help='Bits per voxel.')
    parser.add_argument('-sg',
                        '--isSigned',
                        required=True,
                        type=bool,
                        help='Data format.')
    parser.add_argument('-le',
                        '--littleEndian',
                        required=True,
                        type=bool,
                        help='Data format.')
    parser.add_argument('-s',
                        '--datasetName',
                        type=str,
                        required=True,
                        help='Name of the dataset within the file.')
    parser.add_argument('-o',
                        '--output',
                        type=str,
                        required=True,
                        help='Path to output file')
    args = parser.parse_args()

    parsed_dims = tuple([int(d) for d in args.dimensions.split('x')])
    if len(parsed_dims) != 3:
        raise Exception("Dimension parameter is in an incorrect format.")

    dims: Dimensions = (parsed_dims[0], parsed_dims[1], parsed_dims[2])

    raw_to_h5(args.raw, args.output, args.datasetName, dims, args.usedBits,
              args.isSigned, args.littleEndian)
