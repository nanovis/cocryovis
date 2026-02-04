import json
import torch
import mrcfile
import numpy as np
import os
import sys

from pathlib import Path
from .common import normalizeVol

def loadSpikeTbl(path):
    """
    Loads spike data from tbl file to array 
    Tbl file specification: https://wiki.dynamo.biozentrum.unibas.ch/w/index.php/Table
    
    Parameters
    ----------
      path : path to tbl file
    
    Returns
    ----------
      data: array containing spike positions, rotations and virion id    
    """
    path = Path(path)
    assert path.suffix == '.tbl', 'Input must be .tbl file'

    # Get number of lines 
    data_points = 0
    with open(path, 'r') as f:
        for line in f:
            data_points += 1

    data = np.zeros((data_points, 6), dtype=np.float32)

    with open(path, 'r') as f:
        for i, line in enumerate(f):
            line = line.split()

            data[i, 0] = int(line[20]) # Virion id
            data[i, 1:4] = np.array(line[6:9], dtype=np.float32) # Rotations
            data[i, 4:] = np.array(line[23:26], dtype=np.float32) # Positions

    return data

def saveSpikeTbl(path, positions, rotations):
    """
    Save spike data to tbl file 
    Tbl file specification: https://wiki.dynamo.biozentrum.unibas.ch/w/index.php/Table
    
    Parameters
    ----------
      path : path to tbl file
      positions : matrix contating spike positions
      rotations : matrix contating spike rotations    
    """
    path = Path(path)

    with open(path, 'w') as f:        
        entry = np.zeros((42))

        for i in range(0, positions.shape[0]):
            entry[0] = i + 1
            entry[23:26] = positions[i]
            entry[6:9] = rotations[i]

            for el in entry:
                f.write('{0:.2f}'.format(el) + ' ')
            f.write('\n')

def loadSpikeTblDict(path):
    """
    Loads spike data from tbl file to dictonary
    Tbl file specification: https://wiki.dynamo.biozentrum.unibas.ch/w/index.php/Table
    
    Parameters
    ----------
      path : path to tbl file
    
    Returns
    ----------
      data: dictonary containing spike positions, rotations and virion id    
    """
    path = Path(path)
    assert path.suffix == '.tbl', 'Input must be .tbl file'

    data = []
    with open(path, 'r') as f:
        for line in f:
            line = line.split()

            data.append({'x': float(line[23]),
                         'y': float(line[24]),
                         'z': float(line[25]),
                         'tdrot': float(line[6]),
                         'tilt': float(line[7]),
                         'narot': float(line[8]),
                         'virion_id': int(line[20])})

    return data

def loadMrc(vol_path, normalized=True, cache=True):
    """
    Loads mrc file
    
    Parameters
    ----------
      vol_path : path to folder containing source mrc file for one volume
      normalized : normalize volume upon loading
      cache : cache normalized volume 
    
    Returns
    ----------
      vol_data: loaded volume   
      phys_dims: physical dimensions of extracted volume   
    """
    vol_path = Path(vol_path)
    vols = list(vol_path.rglob('*.mrc'))
    
    # Check cache
    norm_index = -1 
    if normalized:
        for ind, vol in enumerate(vols):
            if 'normalized' in vol.stem: 
                norm_index = ind
                break

    # Load volume
    if norm_index >= 0:
        with mrcfile.open(vols[norm_index], permissive=True) as mrc:
            vol_data = mrc.data.copy()
            phys_dims = np.array([mrc.header.cella.x.item(),
                                  mrc.header.cella.y.item(),
                                  mrc.header.cella.z.item()])
    else:
        with mrcfile.open(vols[0], permissive=True) as mrc:
            vol_data = mrc.data.copy()
            phys_dims = np.array([mrc.header.cella.x.item(),
                                  mrc.header.cella.y.item(),
                                  mrc.header.cella.z.item()])

        if normalized:
            vol_data = normalizeVol(vol_data)

            if cache:
                vol_name = vols[0].stem
                norm_vol = mrcfile.new(vol_path / (vol_name + '_normalized.mrc'), overwrite=True)
                norm_vol.set_data(vol_data)
                norm_vol.header.cella.x = phys_dims[0]
                norm_vol.header.cella.y = phys_dims[1]
                norm_vol.header.cella.z = phys_dims[2]

    return vol_data, phys_dims


def loadSingleMrc(vol_path, normalized=True, cache=True, convertToUint8=False):
    """
    Loads single mrc file
    
    Parameters
    ----------
      vol_path : path to mrc file for one volume
      normalized : normalize volume upon loading
      cache : cache normalized volume 
    
    Returns
    ----------
      vol_data: loaded volume   
      phys_dims: physical dimensions of extracted volume   
    """
    vol_path = Path(vol_path)
    
    with mrcfile.open(vol_path, permissive=True) as mrc:
        vol_data = mrc.data.copy()
        phys_dims = np.array([mrc.header.cella.x.item(),
                                mrc.header.cella.y.item(),
                                mrc.header.cella.z.item()])
        
    if normalized or (convertToUint8 and vol_data.dtype != np.uint8):
        vol_data = normalizeVol(vol_data)

    if convertToUint8 and vol_data.dtype != np.uint8:
        vol_data *= 255
        vol_data = vol_data.astype(np.uint8, copy=False)
                
    return vol_data, phys_dims

def loadSegmented(vol_path):
    """
    Loads segmentation from raw file
    
    Parameters
    ----------
      vol_path : path to folder containing source raw file for one volume
    
    Returns
    ----------
      foreground: loaded segmeted volume   
    """
    jsons = list(vol_path.rglob('*.json'))
    raws = list(vol_path.rglob('*.raw'))

    dirs = list(filter(lambda a: None not in a, zip(raws, jsons)))

    # Load segmentation
    raw_file = dirs[0][0]
    json_file = dirs[0][1]

    f = open(json_file, "r")
    info = json.loads(f.read())
    width = info['size']['x']
    height = info['size']['y']
    depth = info['size']['z']

    resolution = info['usedBits']
    if resolution == 16:
        background = np.fromfile(raw_file, dtype=np.uint16)
        background = np.array(background)
        background = background.reshape(depth, height, width)
        background.byteswap(inplace=True)
        if 'Background' in raw_file.stem:
            foreground = 65535 - background
        else:
            foreground = background
        foreground = foreground.astype(np.float32)
    else:
        background = np.fromfile(raw_file, dtype=np.uint8)
        background = np.array(background)
        background = background.reshape(depth, height, width)
        if 'Background' in raw_file.stem:
            foreground = 255 - background
        else:
            foreground = background
        foreground = foreground.astype(np.float32)

    foreground = normalizeVol(foreground)

    return foreground

def loadJSONVolume(filename, convertToUint8=False):
    jsonFile = open(filename)
    jsonData = json.load(jsonFile)

    volumeFilePath = os.path.dirname(filename) + '//' + jsonData['file']
    print('Loading volume: ' + volumeFilePath)

    volumeFile = open(volumeFilePath)
    
    if "isSigned" not in jsonData:
        raise Exception("JSON description is missing the 'isSigned' field!")
    if "usedBits" not in jsonData:
        raise Exception("JSON description is missing the 'usedBits' field!")
    if jsonData['usedBits'] > 8 and "isLittleEndian" not in jsonData:
        raise Exception("JSON description is missing the 'isLittleEndian' field!")
        
    if jsonData['usedBits'] == 8:
        if jsonData['isSigned']:
            datatype = np.int8
        else:
            datatype = np.uint8
    elif jsonData['usedBits'] == 16:
        if jsonData['isSigned']:
            datatype = np.int16
        else:
            datatype = np.uint16
    elif jsonData['usedBits'] == 32:
        if jsonData['isSigned']:
            datatype = np.int32
        else:
            datatype = np.uint32
    elif jsonData['usedBits'] == 64:
        if jsonData['isSigned']:
            datatype = np.int64
        else:
            datatype = np.uint64
    else:
        raise Exception("Unsupported data format!")
    
    full_datatype = np.dtype(datatype)
    if jsonData['usedBits'] > 8:
        byte_order = '<' if jsonData["isLittleEndian"] else '>'
        full_datatype = np.dtype(byte_order + full_datatype.char)

    npData = np.fromfile(volumeFile, dtype=full_datatype, count=jsonData['size']['x'] * jsonData['size']['y'] * jsonData['size']['z'])
    npData = np.reshape(npData, [jsonData['size']['z'], jsonData['size']['y'], jsonData['size']['x']])
    
    if jsonData['usedBits'] > 8 and ((jsonData["isLittleEndian"] and sys.byteorder == 'big') or (not jsonData["isLittleEndian"] and sys.byteorder == 'little')):
        print(f"Data not in native byte order ({sys.byteorder}), converting...")
        npData = npData.newbyteorder().byteswap(inplace=True)
    
    if convertToUint8 and datatype != np.uint8:
        min_val = np.min(npData)
        max_val = np.max(npData)

        npData = (npData - min_val) / (max_val - min_val) * 255
        npData = npData.astype(np.uint8, copy=False)
        
    return npData


def saveToBinaryFileUint8(volume, filename):
    """
    Save tensor to binary file in uint8 format
    
    Parameters
    ----------
        volume: volume to save
        filename: path
    """
    volume_uint8 = volume - volume.min()
    volume_uint8 = volume_uint8 / volume_uint8.max() * 255;
    volume_uint8 = volume_uint8.to(torch.uint8)
    volume_uint8 = volume_uint8.cpu().numpy();
    # buffer = io.BytesIO()
    # torch.save(volume_uint8, buffer)
    buffer = bytes(volume_uint8)
    with open(filename, 'w+b') as file:
        file.write(buffer)
        file.close()

def saveToBinaryFileUint16(volume, filename):
    """
    Save tensor to binary file in uint16 format
    
    Parameters
    ----------
        volume: volume to save
        filename: path
    """
    volume_uint16 = volume - volume.min()
    volume_uint16 = volume_uint16 / volume_uint16.max() * 65535;
    volume_uint16 = volume_uint16.to(torch.int32)
    volume_uint16 = volume_uint16.cpu().numpy();
    buffer = bytes(volume_uint16)
    with open(filename, 'w+b') as file:
        file.write(buffer)
        file.close()

def saveToBinaryFileFloat32(volume, filename):
    """
    Save tensor to binary file in float format
    
    Parameters
    ----------
        volume: volume to save
        filename: path
    """
    volume_float = volume
    volume_float = volume_float / volume_float.max()
    volume_float = volume_float.to(torch.float32)
    volume_float = volume_float.cpu().numpy()
    buffer = bytes(volume_float)
    with open(filename, 'w+b') as file:
        file.write(buffer)
        file.close()
