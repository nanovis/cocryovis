import numpy as np
import json
import scipy
import scipy.ndimage
import sys

from pathlib import Path
from argparse import ArgumentParser

from Utils.io import loadSingleMrc, loadJSONVolume

def meanFilter(volume_data, output_file, filter_size):
    # mean 3 filter kernel
    kernel = np.ones((filter_size, filter_size, filter_size), dtype=np.uint8) / (filter_size ** 3)

    # apply filter
    filtered = scipy.ndimage.convolve(volume_data, kernel, mode='nearest')

    # invert values
    filtered = 255 - filtered

    # save filtered volume to raw file
    filtered.tofile(output_file, format='uint8')

    # create json header file
    jsonData = {
        'file' : Path(output_file).name,
        'size' : {
            'x' : volume_data.shape[2],
            'y' : volume_data.shape[1],
            'z' : volume_data.shape[0]
        },
        'ratio' : {
            'x' : 1.0,
            'y' : 1.0,
            'z' : 1.0
        },
        'bytesPerVoxel': 1,
        'usedBits': 8,
        'skipBytes': 0,
        'isLittleEndian': volume_data.dtype.byteorder == '|' or volume_data.dtype.byteorder == '<' or (volume_data.dtype.byteorder == '=' and sys.byteorder == 'little'),
        'isSigned': False,
        'addValue': 0
    }
    
    with open(str(Path(output_file).parent) + '/' + Path(output_file).name[:-3] + 'json', "w") as jsonOut:
        jsonOut.write(json.dumps(jsonData, indent=4))
    


if __name__=='__main__':
    parser = ArgumentParser('Mean filter and invert 8-bit volume for visualization purposes')
    parser.add_argument('input_file', type=str, help='Input volume filename')
    parser.add_argument('output_file', type=str, help='Output volume filename')
    parser.add_argument('filter_size', type=int, default=3, nargs='?', help='Filter size')
    args = parser.parse_args()
    
    if args.input_file.endswith(".json") or args.input_file.endswith(".JSON"):
        volume_data = loadJSONVolume(args.input_file, convertToUint8=True)
    elif args.input_file.endswith(".mrc"):
        volume_data, _ = loadSingleMrc(args.input_file, convertToUint8=True)

    meanFilter(volume_data, args.output_file, args.filter_size)