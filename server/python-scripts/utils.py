import os


def generate_unique_filename(directory: str, filename: str) -> str:
    name, extension = os.path.splitext(filename)

    unique_filename = filename
    counter = 1

    while os.path.exists(os.path.join(directory, unique_filename)):
        unique_filename = f"{name}_{counter}{extension}"
        counter += 1

    return unique_filename


def generate_settings_object(raw_filename: str,
                             width: int,
                             height: int,
                             depth: int,
                             bytes_per_voxel: int,
                             used_bits: int,
                             is_signed: bool,
                             is_little_endian: bool,
                             physicalUnit: str = "PIXEL",
                             physicalSizeX: float = 1,
                             physicalSizeY: float = 1,
                             physicalSizeZ: float = 1) -> dict:
    return {
        "file": raw_filename,
        "size": {
            "x": width,
            "y": height,
            "z": depth
        },
        "physicalUnit": physicalUnit,
        "physicalSize": {
            "x": physicalSizeX,
            "y": physicalSizeY,
            "z": physicalSizeZ
        },
        "bytesPerVoxel": bytes_per_voxel,
        "usedBits": used_bits,
        "skipBytes": 0,
        "isLittleEndian": is_little_endian,
        "isSigned": is_signed,
        "addValue": 0,
    }
