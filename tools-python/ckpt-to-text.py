import torch
from argparse import ArgumentParser

def ckpt_to_text(checkpoin_path):
    checkpoint = torch.load(checkpoin_path)
    state_dict = checkpoint['state_dict']

    for param_tensor in state_dict:
        print(f"{param_tensor}:", end="")
        param_data = state_dict[param_tensor].cpu().numpy()
        if param_data.ndim == 0:
            print(f"{param_data}\n", end="")
        else:
            print(', '.join(map(str, param_data.flatten())) + "\n", end="")

if __name__ == '__main__':
    parser = ArgumentParser('Convert torch checkpoint file to text.')
    parser.add_argument('-c', '--checkpoint', type=str, required=True, help='Path to input checkpoint.')
    args = parser.parse_args()

    ckpt_to_text(args.checkpoint)
