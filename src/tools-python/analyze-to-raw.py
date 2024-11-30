import json
import os
from argparse import ArgumentParser
from pathlib import Path
import numpy as np
from utils import generate_unique_filename, generate_settings_object
import nibabel as nib

# Analyze format specs:
# http://www.grahamwideman.com/gw/brain/analyze/formatdoc.htm


def analyze_to_raw(file_path, output_path):
    hdr_file = nib.load(file_path)
    data_type = hdr_file.get_data_dtype()
    dimensions = hdr_file.shape
    
    # data = hdr_file.get_fdata()
    # data = data[:, :, :, 0]
    # if data.flags['F_CONTIGUOUS']:
    #     print("Array is Fortran-contiguous. Converting to C-contiguous...")
    #     data = np.ascontiguousarray(data)
    # data = np.transpose(data, (2, 1, 0))

    input_raw_file_path = os.path.join(os.path.dirname(file_path),
                                       hdr_file.file_map['image'].filename)

    data = np.fromfile(input_raw_file_path, dtype=np.float32)
    data = np.reshape(data, [dimensions[2], dimensions[1], dimensions[0]])
    
    raw_file_output = f"{Path(file_path).stem}.raw"

    if data_type.kind == 'f':
        # If the data is float, convert to uint8 and normalize
        max_val = data.max()
        min_val = data.min()

        data = (data - min_val) / (max_val - min_val)
        data = data * 255
        data = data.astype(np.uint8)

        bytes_per_voxel = 1
        used_bits = 8
        is_signed = False
    elif data_type.kind == 'u' or data_type.kind == 'i':
        bytes_per_voxel = data_type.itemsize
        used_bits = data_type.itemsize * 8
        is_signed = data_type.kind == 'i'
    else:
        raise Exception("Analyze file data is in incompatible format.")

    raw_filename = generate_unique_filename(output_path, raw_file_output)

    data.tofile(os.path.join(output_path, raw_filename))

    json_output = generate_settings_object(raw_filename, dimensions[0],
                                           dimensions[1], dimensions[2],
                                           bytes_per_voxel, used_bits,
                                           is_signed, True)

    print(json.dumps(json_output))


if __name__ == '__main__':
    parser = ArgumentParser(
        'Convert an Analysis volume into a RAW data file with JSON setting.')
    parser.add_argument('-i',
                        '--input',
                        dest="input",
                        type=str,
                        help='Input Analysis file',
                        required=True)
    parser.add_argument('-o'
                        '--output',
                        dest="output",
                        type=str,
                        help='Output directory',
                        required=True)
    args = parser.parse_args()

    analyze_to_raw(Path(args.input), Path(args.output))
