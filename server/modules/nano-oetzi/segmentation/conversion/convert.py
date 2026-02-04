import torch
from argparse import ArgumentParser
from pathlib import Path
import numpy as np
import json
import mrcfile
import rawpy

# %% Main
if __name__ == '__main__':

    parser = ArgumentParser("VoReCEM to PyTorch serialized dict")
    parser.add_argument('vorecem_path', type=str, help='Path to VoReCEM data, as is online')
    parser.add_argument('save_path', type=str, help='Directory to save the PyTorch tensors to')
    args = parser.parse_args()
    # %% Get file paths for .mrc's and labels
    p = Path(args.vorecem_path)

    vols = list(p.rglob('*float32*.raw'))
    vjsons = list(p.rglob('*float32*.json'))
    raws = list(p.rglob('*16bit*.raw'))
    jsons = list(p.rglob('*16bit*.json'))

    dirs = list(filter(lambda a: None not in a, zip(vols, vjsons, raws, jsons)))
    # dirs = list(filter(lambda a: None not in a, zip(vols, vjsons, raws, jsons)))
    save_dir = Path(args.save_path)

    print(dirs)
    for vol_file, vjson_file, raw_file, json_file in dirs:

        print('Found the following datasets:')
        print('---------------------------')
        print(f'  Volume: {vol_file}')
        print(f'  Labels: {raw_file}')

        f = open(json_file, "r")
        info = json.loads(f.read())
        width = info['size']['x']
        height = info['size']['y']
        depth = info['size']['z']

        f1 = open(vjson_file, "r")
        info1 = json.loads(f1.read())

        resolution = info1['usedBits']
        if resolution == 32:
            print('Orig ...')
            background = np.fromfile(vol_file, dtype=np.float32)
            background = np.array(background)
            background = background.reshape(depth, height, width)
            background = background + background.min()
            foreground = background / background.max()
            data = torch.from_numpy(foreground)
            phys_dims = torch.FloatTensor([int(info['size']['x']),
                                           int(info['size']['y']),
                                           int(info['size']['z'])])

        if resolution == 16:
            print('Label ...')
            background = np.fromfile(raw_file, dtype=np.uint16)
            background = np.array(background)
            background = background.reshape(depth, height, width)
            foreground = 65535 - background
            foreground = foreground.astype(np.uint8)
            label = torch.from_numpy(foreground)
            label = label.float()
            label = torch.flip(label, dims=[1])
        else:
            background = np.fromfile(raw_file, dtype=np.uint8)
            background = background.reshape(depth, height, width)
            background = np.array(background)
            foreground = 255 - background
            foreground = foreground.astype(np.uint8)
            label = torch.from_numpy(foreground)
            label = label.float()
            label = torch.flip(label, dims=[1])

        # with mrcfile.open(mrc_file, permissive=True) as mrc:
        #     data = torch.from_numpy(mrc.data.copy())
        #     phys_dims = torch.FloatTensor([mrc.header.cella.x.item(),
        #                                    mrc.header.cella.y.item(),
        #                                    mrc.header.cella.z.item()])

        torch.save({
            'vol': data,
            'label': label,
            'phys_dims': phys_dims,
            'name': mrc_file.stem
        }, save_dir / f'{mrc_file.stem}.pt')




