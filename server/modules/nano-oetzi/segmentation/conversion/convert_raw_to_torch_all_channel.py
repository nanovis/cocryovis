import torch
from argparse import ArgumentParser
from pathlib import Path
import numpy as np
import json
import mrcfile


# %% Main
if __name__ == '__main__':

    parser = ArgumentParser("VoReCEM to PyTorch serialized dict")
    parser.add_argument('volume_path', type=str, help='Path to VoReCEM volume, as is online')
    parser.add_argument('membrane_path', type=str, help='Path to VoReCEM membrane, as is online')
    parser.add_argument('spikes_path', type=str, help='Path to VoReCEM spikes, as is online')
    parser.add_argument('inner_path', type=str, help='Path to VoReCEM inner, as is online')
    parser.add_argument('save_path', type=str, help='Directory to save the PyTorch tensors to')
    args = parser.parse_args()
    # %% Get file paths for .mrc's and labels
    volume_dir = Path(args.volume_path)
    membrane_dir = Path(args.membrane_path)
    spikes_dir = Path(args.spikes_path)
    inner_dir = Path(args.inner_path)

    vols = sorted(list(volume_dir.rglob('*.mrc')))
    membrane_raws = sorted(list(membrane_dir.rglob('*.raw')))
    membrane_jsons = sorted(list(membrane_dir.rglob('*.json')))
    spikes_raws = sorted(list(spikes_dir.rglob('*.raw')))
    inner_raws = sorted(list(inner_dir.rglob('*.raw')))

    dirs = list(filter(lambda a: None not in a, zip(vols, membrane_raws, membrane_jsons, spikes_raws, inner_raws)))
    save_dir = Path(args.save_path)

    for mrc_file, membrane_file, json_file, spikes_file, inner_file in dirs:
        print('Found the following datasets:')
        print(f'  Volume: {mrc_file}')
        print(f'  Membrane: {membrane_file}')
        print(f'  Spikes: {spikes_file}')
        print(f'  Inner: {inner_file}')
        print('---------------------------')

        f = open(json_file, "r")
        info = json.loads(f.read())
        width = info['size']['x']
        height = info['size']['y']
        depth = info['size']['z']

        resolution = info['usedBits']
        if resolution == 16:
            membrane = np.fromfile(membrane_file, dtype=np.uint16)
            membrane = np.array(membrane)
            membrane = membrane.reshape(depth, height, width)
            membrane.byteswap(inplace=True)
            membrane = membrane.astype(np.float32)
            membrane = torch.from_numpy(membrane)
            membrane = membrane.float()
            membrane = torch.flip(membrane, dims=[1])

            spikes = np.fromfile(spikes_file, dtype=np.uint16)
            spikes = np.array(spikes)
            spikes = spikes.reshape(depth, height, width)
            spikes.byteswap(inplace=True)
            spikes = spikes.astype(np.float32)
            spikes = torch.from_numpy(spikes)
            spikes = spikes.float()
            spikes = torch.flip(spikes, dims=[1])

            inner = np.fromfile(inner_file, dtype=np.uint16)
            inner = np.array(inner)
            inner = inner.reshape(depth, height, width)
            inner.byteswap(inplace=True)
            inner = inner.astype(np.float32)
            inner = torch.from_numpy(inner)
            inner = inner.float()
            inner = torch.flip(inner, dims=[1])

            background = torch.empty(membrane.shape).fill_(65535.)
            all = torch.mul(torch.sum(torch.stack([membrane, spikes, inner]), dim=0), -1.)
            background = torch.add(background, all)

        with mrcfile.open(mrc_file, permissive=True) as mrc:
            data = torch.from_numpy(mrc.data.copy())
            phys_dims = torch.FloatTensor([mrc.header.cella.x.item(),
                                           mrc.header.cella.y.item(),
                                           mrc.header.cella.z.item()])

        torch.save({
            'vol': data,
            'membrane': membrane,
            'spikes': spikes,
            'inner': inner,
            'background': background,
            'phys_dims': phys_dims,
            'name': mrc_file.stem
        }, save_dir/f'{mrc_file.stem}.pt')




