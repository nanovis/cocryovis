import os
import sys
from typing import Tuple
import mrcfile
from argparse import ArgumentParser
from pathlib import Path
import numpy as np


def raw_to_mrc(raw_path: str,
               shape: Tuple[int, int, int],
               bits: str,
               signed: bool,
               mrc_path: str = None,
               is_little_endian: bool = True):

    if mrc_path is None:
        mrc_path = os.path.join(
            Path(raw_path).parent,
            Path(raw_path).stem + ".mrc")

    with open(raw_path, "rb") as raw_file:
        raw_data = raw_file.read()

    if bits == 8:
        dtype = np.int8
    elif bits == 16:
        if signed:
            dtype = np.int16
        else:
            dtype = np.uint16
    elif bits == 32:
        if signed:
            dtype = np.int32
        else:
            dtype = np.uint32
    elif bits == 64:
        if signed:
            dtype = np.int64
        else:
            dtype = np.uint64
    else:
        raise ValueError("Invalid number of bits")

    full_dtype = np.dtype(dtype)
    byte_order = '<' if is_little_endian else '>'
    full_dtype = np.dtype(byte_order + full_dtype.char)

    data = np.frombuffer(raw_data, dtype=full_dtype)

    expected_size = np.prod(shape)
    if data.size != expected_size:
        raise ValueError(
            f"Mismatch in data size: expected {expected_size}, got {data.size}"
        )

    data = data.reshape((shape[2], shape[1], shape[0]))
    if sys.byteorder == "big":
        data = data.byteswap()

    with mrcfile.new(mrc_path, overwrite=True) as mrc:
        mrc.set_data(data)
        mrc.update_header_from_data()

    print(f"Converted {Path(raw_path).name} to {Path(mrc_path).name}")


if __name__ == '__main__':
    parser = ArgumentParser(description="Convert RAW data to an MRC file.")
    parser.add_argument("raw_path", type=str, help="Path to the RAW file.")
    parser.add_argument("shape",
                        type=int,
                        nargs=3,
                        help="Shape of the data (z, y, x).")
    parser.add_argument("bits",
                        type=int,
                        choices=[8, 16, 32, 64],
                        help="Number of bits per voxel.")
    parser.add_argument("signed",
                        type=int,
                        choices=[0, 1],
                        help="Set to 1 for signed, 0 for unsigned.")
    parser.add_argument("--mrc_path",
                        type=str,
                        default=None,
                        help="Path to the output MRC file (optional).")
    parser.add_argument(
        "--big_endian",
        action="store_true",
        help="Use big-endian byte order (default: little-endian).")

    args = parser.parse_args()
    print(args)

    raw_to_mrc(raw_path=args.raw_path,
               shape=tuple(args.shape),
               bits=args.bits,
               signed=bool(args.signed),
               mrc_path=args.mrc_path,
               is_little_endian=not args.big_endian)
