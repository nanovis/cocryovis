import json
import os
from argparse import ArgumentParser
from pathlib import Path

import numpy as np
import torch


def loadAndNormalizeRawVolume(volume_path, properties):
    with open(volume_path) as raw_volume_file:
        np_data = np.fromfile(raw_volume_file, dtype=np.uint8,
                              count=properties['dimensions']['x'] * properties['dimensions']['y'] *
                                    properties['dimensions']['z'])

        np_data = np.reshape(np_data, [
            properties['dimensions']['z'],
            properties['dimensions']['y'],
            properties['dimensions']['x']
        ])

        np_data = np.float32(np_data)
        min_val = np.min(np_data)
        max_val = np.max(np_data)
        np_data = (np_data - min_val) / (max_val - min_val)

        return torch.from_numpy(np_data)


def prepare_volume(volume_input, properties, output_file_path, log=False):
    if log:
        print('Converting volume: ', volume_input['name'])

    raw_volume_tensor = loadAndNormalizeRawVolume(volume_input['rawDataPath'], properties)
    label_tensors = []

    for label_path in volume_input['labels']:
        label_tensors.append(loadAndNormalizeRawVolume(label_path, properties))

    label = torch.stack(label_tensors)
    label = torch.argmax(label, dim=0)

    torch.save({
        'vol': raw_volume_tensor,
        'label': label,
        'name': f"{volume_input['name']}",
    }, output_file_path)


def prepare_set(volume_inputs, properties, set_name, base_dir, log=False):
    output_dir_path = Path(base_dir, set_name)
    if not output_dir_path.exists():
        os.makedirs(output_dir_path)

    for i, volume_input in enumerate(volume_inputs):
        output_path = Path(output_dir_path, f"Volume_{i}_{volume_input['name']}.pt")

        prepare_volume(volume_input, properties, output_path, log)
        if log:
            print(f"Volume {volume_input['name']} successfully converted to "
                  f"({set_name}) volume {os.path.basename(output_path)}")


def raws_to_train_sets(input_configuration, out_dir_path, log=False):
    if log:
        print('Preparing temporary directories')

    properties = input_configuration['properties']
    prepare_set(input_configuration['train'], properties, 'train', out_dir_path, log)
    prepare_set(input_configuration['valid'], properties, 'valid', out_dir_path, log)
    prepare_set(input_configuration['test'], properties, 'test', out_dir_path, log)


if __name__ == '__main__':
    parser = ArgumentParser('Train volume on volume with depth <= 512')
    parser.add_argument('-i', '--input', required=True, type=str, help='Path to training configuration file.')
    parser.add_argument('-o', '--output', type=str, help='Path to output directory')
    parser.add_argument('-v', type=bool, default=True, help='Output the process status.')
    args = parser.parse_args()

    with open(args.input) as input_config:
        raws_to_train_sets(json.load(input_config), args.output, args.v)
