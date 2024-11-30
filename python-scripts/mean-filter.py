import numpy as np
import json
import scipy
import scipy.ndimage

from pathlib import Path
from argparse import ArgumentParser

def meanFilter(input_file, width, height, depth, output_file, filter_size):
    # read raw file
    rawFile = open(input_file)
    # transform to numpy array
    raw = np.fromfile(rawFile, dtype=np.uint8)
    # reshape to 3D array
    raw = raw.reshape((depth, height, width))

    # mean 3 filter kernel
    kernel = np.ones((filter_size, filter_size, filter_size), dtype=np.uint8) / (filter_size ** 3)

    # apply filter
    filtered = scipy.ndimage.convolve(raw, kernel, mode='nearest')

    # invert values
    filtered = 255 - filtered

    # save filtered volume to raw file
    filtered.tofile(output_file, format='uint8')  


if __name__=='__main__':
    parser = ArgumentParser('Mean filter and invert 8-bit volume for visualization purposes')
    parser.add_argument('input_file', type=str, help='Raw data volume path')
    parser.add_argument('width', type=int, help='Volume width')
    parser.add_argument('height', type=int, help='Volume height')
    parser.add_argument('depth', type=int, help='Volume depth')
    parser.add_argument('output_file', type=str, help='Output volume filename')
    parser.add_argument('filter_size', type=int, default=3, nargs='?', help='Filter size')
    args = parser.parse_args()

    meanFilter(args.input_file, args.width, args.height, args.depth, args.output_file, args.filter_size)