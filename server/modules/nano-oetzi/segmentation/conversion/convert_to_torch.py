# %% Imports
import torch
import mrcfile

from argparse import ArgumentParser
from pathlib import Path
from functools import partial
from PIL import Image
import numpy as np
import os

# %% Helper Functions
def get_foreground_vol(p):
    ''' Gets the foreground folder next to a given .mrc path

    Args:
        p (Path): Path to .mrc file

    Returns:
        Path: Path to label directory (containing .tiffs), None if there is no directory with Foreground in the name
    '''
    fgs = [p.parent/d for d in os.listdir(p.parent)
        if (p.parent/d).is_dir() and p.stem in d and 'Foreground' in d]
    if len(fgs) > 0: return fgs[0]
    else: return None

def convert(item_fn, label_dir, save_dir, dryrun=False):
    ''' Converts a given .mrc file and label folder to PyTorch tensor

    Args:
        item_fn (Path): Path to .mrc file
        label_dir (Path): Path to label directory (foreground .tiffs)
        save_dir (Path): Path where the PyTorch tensors are saved to
        dryrun  (bool): If True, only prints what is saved, but does not actually write
    '''
    print(f'Converting {str(item_fn)}')
    with mrcfile.open(item_fn, permissive=True) as mrc:
        data = torch.from_numpy(mrc.data.copy())
        phys_dims = torch.FloatTensor([mrc.header.cella.x.item(),
                                       mrc.header.cella.y.item(),
                                       mrc.header.cella.z.item()])
    label = torch.from_numpy(np.stack([np.array(Image.open(label_dir/l)) for l in os.listdir(label_dir)]))
    print(f"Saving to {save_dir/f'{item_fn.stem}.pt'}:\n Volume ({data.shape, data.dtype}), Label ({label.shape, label.dtype}), Physical Dimensions ({phys_dims})")
    if not dryrun:
        torch.save({
            'vol': data,
            'label': label,
            'phys_dims': phys_dims,
            'name': item_fn.stem
        }, save_dir/f'{item_fn.stem}.pt')

# %% Main
if __name__ == '__main__':
    parser = ArgumentParser("VoReCEM to PyTorch serialized dict")
    parser.add_argument('vorecem_path', type=str, help='Path to VoReCEM data, as is online')
    parser.add_argument('save_path', type=str, help='Directory to save the PyTorch tensors to')
    parser.add_argument('-dryrun', action='store_true', help='Only print info, do not write files yet')
    args = parser.parse_args()
    # %% Get file paths for .mrc's and labels
    p = Path(args.vorecem_path)
    vols = list(p.rglob('*.mrc')) + list(p.rglob('*.sqz')) + list(p.rglob('*.rec'))
    fg_dirs = list(map(get_foreground_vol, vols))
    dirs = list(filter(lambda a: None not in a, zip(vols, fg_dirs)))
    if args.dryrun:
        print('Found the following datasets:')
        for i, l in dirs:
            print('---------------------------')
            print(f'  Volume: {i}')
            print(f'  Labels: {l}')
        print('Loading Volumes:')
    # %% Convert to PyTorch Tensors
    conv = partial(convert, save_dir=Path(args.save_path), dryrun=args.dryrun)

    for i, l in dirs: conv(i, l)

# %%
