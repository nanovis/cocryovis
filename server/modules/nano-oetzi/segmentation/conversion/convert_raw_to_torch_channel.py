import torch
from argparse import ArgumentParser
from pathlib import Path
import numpy as np
import json
import mrcfile


# %% Main
if __name__ == '__main__':

    parser = ArgumentParser("VoReCEM to PyTorch serialized dict")
    parser.add_argument('volume_path', type=str, help='Path to VoReCEM data, as is online')
    parser.add_argument('label_path', type=str, help='Path to VoReCEM data, as is online')
    parser.add_argument('save_path', type=str, help='Directory to save the PyTorch tensors to')
    args = parser.parse_args()
    # %% Get file paths for .mrc's and labels
    volume_dir = Path(args.volume_path)
    label_dir = Path(args.label_path)

    vols = list(volume_dir.rglob('*.mrc'))
    raws = list(label_dir.rglob('*.raw'))
    jsons = list(label_dir.rglob('*.json'))

    dirs = list(filter(lambda a: None not in a, zip(vols, raws, jsons)))
    save_dir = Path(args.save_path)

    for mrc_file, raw_file, json_file in dirs:
        print('Found the following datasets:')
        print(f'  Volume: {mrc_file}')
        print('---------------------------')
        print(f'  Labels: {raw_file}')

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
            label = torch.from_numpy(foreground)
            label = label.float()
            label = torch.flip(label, dims=[1])
        else:
            background = np.fromfile(raw_file, dtype=np.uint8)
            background = background.reshape(depth, height, width)
            background = np.array(background)
            if 'Background' in raw_file.stem:
                foreground = 255 - background
            else:
                foreground = background
            foreground = foreground.astype(np.float32)
            foreground.byteswap(inplace=True)
            label = torch.from_numpy(foreground)
            label = label.float()
            label = torch.flip(label, dims=[1])

        with mrcfile.open(mrc_file, permissive=True) as mrc:
            data = torch.from_numpy(mrc.data.copy())
            phys_dims = torch.FloatTensor([mrc.header.cella.x.item(),
                                           mrc.header.cella.y.item(),
                                           mrc.header.cella.z.item()])

        torch.save({
            'vol': data,
            'label': label,
            'phys_dims': phys_dims,
            'name': mrc_file.stem
        }, save_dir/f'{raw_file.stem}.pt')




