import torch
import numpy as np
from argparse import ArgumentParser
from pathlib import Path

if __name__ == '__main__':
    parser = ArgumentParser("VoReCEM Save Data")
    parser.add_argument('predict_path', type=str, help='Path to predicted data')
    parser.add_argument('save_path', type=str, help='Path to save the raw file')

    args = parser.parse_args()
    data_path = Path(args.predict_path)
    save_path=Path(args.save_path)

    data = torch.load(data_path)
    data -= data.min(1, keepdim=True)[0]
    data /= (data.max(1, keepdim=True)[0] - data.min(1, keepdim=True)[0])
    data *= 255
    data = data.numpy()
    print('\n data.shape: ', data.shape)

    newFile = open(save_path, "wb")
    newFile.write(data.astype('uint8'))


