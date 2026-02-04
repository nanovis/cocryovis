import torch
from argparse import ArgumentParser
from pathlib import Path

if __name__ == '__main__':

    parser = ArgumentParser("VoReCEM to PyTorch serialized dict")
    parser.add_argument('data_dir', type=str, help='Directory of pt files')
    parser.add_argument('save_dir', type=str, help='Directory to save the normalized data')
    args = parser.parse_args()
    # %% Get file paths for volumes and labels

    p = Path(args.data_dir)
    data_dir = list(p.rglob('*.pt'))
    save_dir = Path(args.save_dir)

    for data_path in data_dir:

        data = torch.load(data_path)
        vol = data['vol']
        label = data['label']
        name = data['name']

        vol -= vol.min()
        vol /= vol.max()

        label -= label.min()
        label /= label.max()

        # Change soft label to hard label
        label = torch.argmax(label, dim=0)

        torch.save({
            'vol': vol,
            'label': label,
            'phys_dims': data['phys_dims'],
            'name': f'{data_path.stem}_norm',
        }, save_dir/f'{data_path.stem}_norm.pt')
