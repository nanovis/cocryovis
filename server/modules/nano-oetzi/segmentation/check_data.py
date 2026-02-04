from pathlib import Path
import torch
import matplotlib.pyplot as plt
from argparse import ArgumentParser

if __name__ == '__main__':
    parser = ArgumentParser('Checks and corrects the data.')
    parser.add_argument('input_file_path', type=str, help='Input pt file')
    parser.add_argument('output_file_path', type=str, help='Output pt file')
    args = parser.parse_args()

    data_dir = Path(args.input_file_path)
    save_dir = Path(args.output_file_path)
#    data_dir = Path('../../Tomography/Nature/emd_11867-2-splits')
#    save_dir = Path('../../Tomography/Nature/emd_11867-2-splits')
    files = list(data_dir.rglob('*.pt'))
    for file in files:
        data_path = Path(file)
        print(data_path)
        data = torch.load(data_path)
        data = data.type(torch.float32)
        print(data.shape, data.type())
        print(data.min(), data.max())

        data -= data.min()
        data /= data.max()

        torch.save({
            'vol': data,
        }, save_dir / f'{data_path.stem}_norm.pt')

    # plt.imshow(data[data.shape[0] // 2])
    # plt.title(f'Fig emd_11865_2_spilts_{data_path.stem}_{data.shape[0] // 2}')
    # plt.show()
