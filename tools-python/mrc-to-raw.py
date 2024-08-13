import json
import os
import mrcfile
from argparse import ArgumentParser
from pathlib import Path
import numpy as np


def mrc_to_raw(mrc_file_path, output_path):
    with mrcfile.open(mrc_file_path, mode='r+', permissive=True) as mrc:
        data = mrc.data

        if not isinstance(data, np.ndarray):
            raise TypeError("Data is not a numpy array")

        raw_file_output = f"{Path(mrc_file_path).stem}.raw"
        json_file_output = f"{Path(mrc_file_path).stem}.json"

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

        data.tofile(os.path.join(output_path, raw_file_output))

        json_output = {
            "file": raw_file_output,
            "size": {
                "x": mrc.header.nx.item(),
                "y": mrc.header.ny.item(),
                "z": mrc.header.nz.item()
            },
            "ratio": {
                "x": 1.0,
                "y": 1.0,
                "z": 1.0
            },
            "bytesPerVoxel": bytes_per_voxel,
            "usedBits": used_bits,
            "skipBytes": 0,
            "isLittleEndian": True,
            "isSigned": is_signed,
            "addValue": 0,
            "transferFunction": "tf-default.json"
        }

        with open(os.path.join(output_path, json_file_output), "w") as outfile:
            outfile.write(json.dumps(json_output, indent=2))


if __name__ == '__main__':
    parser = ArgumentParser('Convert a MRC volume into a RAW data file with JSON setting.')
    parser.add_argument('-i', '--input', dest="input", type=str, help='Input MRC file', required=True)
    parser.add_argument('-o' '--output', dest="output", type=str, help='Output directory', required=True)
    args = parser.parse_args()

    mrc_to_raw(Path(args.input), Path(args.output))
