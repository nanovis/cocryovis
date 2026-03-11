import json
import os
import mrcfile
from argparse import ArgumentParser
from pathlib import Path
import numpy as np
from utils import generate_unique_filename, generate_settings_object


def mrc_to_raw(mrc_file_path, output_path):
    with mrcfile.open(mrc_file_path, mode='r+', permissive=True) as mrc:
        data = mrc.data

        if not isinstance(data, np.ndarray):
            raise TypeError("Data is not a numpy array")

        raw_file_output = f"{Path(mrc_file_path).stem}.raw"
        # json_file_output = f"{Path(mrc_file_path).stem}.json"

        mrc.update_header_from_data()

        if mrc.header.mode == 0:
            bytes_per_voxel = 1
            used_bits = 8
            is_signed = True
        elif mrc.header.mode == 1:
            bytes_per_voxel = 2
            used_bits = 16
            is_signed = True
        elif mrc.header.mode == 6:
            bytes_per_voxel = 2
            used_bits = 16
            is_signed = False
        elif mrc.header.mode in [2, 12]:
            max_val = data.max()
            min_val = data.min()
            data = (data - min_val) / (max_val - min_val)
            data = data * 255
            data = data.astype(np.uint8)

            bytes_per_voxel = 1
            used_bits = 8
            is_signed = False
        else:
            raise Exception("MRC file data is in incompatible format.")

        voxel_size = {
            "x": mrc.header.cella.x / mrc.header.mx.item(),
            "y": mrc.header.cella.y / mrc.header.my.item(),
            "z": mrc.header.cella.z / mrc.header.mz.item(),
        }

        physical_size = {
            "x": voxel_size["x"] * mrc.header.nx.item(),
            "y": voxel_size["y"] * mrc.header.ny.item(),
            "z": voxel_size["z"] * mrc.header.nz.item(),
        }

        raw_filename = generate_unique_filename(output_path, raw_file_output)

        # Flip the data along the y-axis
        data = np.flip(data, axis=1)

        data.tofile(os.path.join(output_path, raw_filename))

        json_output = generate_settings_object(
            raw_filename=raw_filename,
            width=mrc.header.nx.item(),
            height=mrc.header.ny.item(),
            depth=mrc.header.nz.item(),
            bytes_per_voxel=bytes_per_voxel,
            used_bits=used_bits,
            is_signed=is_signed,
            is_little_endian=True,
            physicalUnit="ANGSTROM",
            physicalSizeX=physical_size["x"],
            physicalSizeY=physical_size["y"],
            physicalSizeZ=physical_size["z"])

        # with open(os.path.join(output_path, json_file_output), "w") as outfile:
        #     outfile.write(json.dumps(json_output, indent=2))
        print(json.dumps(json_output))


if __name__ == '__main__':
    parser = ArgumentParser(
        'Convert a MRC volume into a RAW data file with JSON setting.')
    parser.add_argument('-i',
                        '--input',
                        dest="input",
                        type=str,
                        help='Input MRC file',
                        required=True)
    parser.add_argument('-o'
                        '--output',
                        dest="output",
                        type=str,
                        help='Output directory',
                        required=True)
    args = parser.parse_args()

    mrc_to_raw(Path(args.input), Path(args.output))
