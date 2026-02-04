import json
import os
import fnmatch
import re
from pathlib import Path
from argparse import ArgumentParser
import subprocess
import sys

def run_command(command):
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    for line in process.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()

    for line in process.stderr:
        sys.stderr.write(line)
        sys.stderr.flush()

    process.wait()

    if process.returncode != 0:
        raise subprocess.CalledProcessError(process.returncode, command)

if __name__=='__main__':
    parser = ArgumentParser('Run inference on volume with depth <= 512')
    parser.add_argument('input_file_path', type=str, help='MRC file or JSON volume header file')
    parser.add_argument('output_dir_path', type=str, help='Output path for inference')
    parser.add_argument('-v', type=bool, default=True, help='Output the process status.')
    parser.add_argument('-c', type=bool, default=False, help='Clean the output directory and remove temporary files.')
    parser.add_argument('-m', nargs='?', default='../models/four_classes_model.ckpt', help='Model path')
    args = parser.parse_args()
    
    output_dir_path = Path(args.output_dir_path)
    # Prepare tmp directories
    if args.v:
        print('Preparing temporary directories')
    if not output_dir_path.exists(): os.mkdir(output_dir_path)

    output_splits_dir_path = Path(output_dir_path, 'splits')
    if not output_splits_dir_path.exists(): os.mkdir(output_splits_dir_path)
    # print(output_splits_dir_path)

    output_norm_splits_dir_path = Path(output_splits_dir_path, 'norm_splits')
    if not output_norm_splits_dir_path.exists(): os.mkdir(output_norm_splits_dir_path)
    # print(output_norm_splits_dir_path)

    output_predictions_dir_path = Path(output_splits_dir_path, 'predictions')
    if not output_predictions_dir_path.exists(): os.mkdir(output_predictions_dir_path)
    # print(output_predictions_dir_path)


    # Split volume into chunks of depth<=512 x 512 x 512
    output = ""
    if args.v:
        print('Spliting the volume into chunks.')  
    run_command(['python', './split.py', args.input_file_path, str(output_splits_dir_path)])
    
    # Check and normalize the chunk files
    if args.v:
        print('Checking and normalizing the chunks.')        
    run_command(['python', './check_data.py', str(output_splits_dir_path), str(output_norm_splits_dir_path)])

    # Run inference on chunks
    if args.v:
        print('Running inference.')
    files = sorted(os.listdir(output_norm_splits_dir_path))
    print("M", args.m)
    for f in files:
        run_command(['python', './test_transfer.py', str(output_norm_splits_dir_path) + '/' + f, '--checkpoint', args.m, '--output_path', str(output_predictions_dir_path)])

    
    # Rename files to match the needed name pattern
    if args.v:
        print('Renaming the chunk files to match the needed name pattern.')
    files = sorted(os.listdir(output_predictions_dir_path))
    selected_files = []
    for f in files:
        if fnmatch.fnmatch(f, '*0*'):
            selected_files.append(f)
    
    f = selected_files[0]
    v = re.search(r"0", f)
    input_pattern = f[:v.start()] + '?' + f[v.start()+1:]
    output_pattern = f[:v.start()] + f[v.start()+2:-3] + '_?.pt'
    run_command(['python', './rename_files.py', str(output_predictions_dir_path) + '/', input_pattern, output_pattern])

    f = selected_files[1]
    v = re.search(r"0", f)
    input_pattern = f[:v.start()] + '?' + f[v.start()+1:]
    output_pattern = f[:v.start()] + f[v.start()+2:-3] + '_?.pt'
    run_command(['python', './rename_files.py', str(output_predictions_dir_path) + '/', input_pattern, output_pattern])


    # Stitch chunks into output volumes
    if args.v:
        print('Stitching prediction chunks into output files.')
    stitch_prefix = 'split_norm_predictions_'
    splits_json_path = str(output_splits_dir_path) + '/splits.json'
    tile_locations_prefix = str(output_predictions_dir_path) + '/split_norm_tile_locations_'
    output_name = os.path.basename(args.input_file_path)
    output_files_prefix = output_name[:-5] + '_predictions'
    run_command(['python', './stitch.py', stitch_prefix, str(output_predictions_dir_path) + '/', str(output_dir_path) + '/', splits_json_path, tile_locations_prefix, output_files_prefix])

    # Create JSON header for output volume files
    if args.v:
        print('Creating JSON header files for output volumes.')
    
    # Create mean-3 filtered inverted version of the input volume
    if args.v:
        print('Creating mean-3 filtered inverted version of the input volume.')
        print('input: ' + str(args.input_file_path))
        print('output: ' + str(output_dir_path) + '/' + str(output_name[:-5]) + '_mean3_inverted.raw')
    run_command(['python', './mean_filtering.py', str(args.input_file_path), str(output_dir_path) + '/' + str(output_name[:-5]) + '_mean3_inverted.raw'])

    output = []

    files = os.listdir(output_dir_path)
    for f in files:
        if fnmatch.fnmatch(f, '*.raw'):
            settingsFile = Path(f).stem
            fileDescriptor = {
                "rawFileName": f,
                "settingsFileName": settingsFile + ".json",
            }
            if '-Spikes.raw' in f:
                fileDescriptor["name"] = "Spikes"
                fileDescriptor["index"] = 0
            elif '-Membrane.raw' in f:
                fileDescriptor["name"] = "Membrane"
                fileDescriptor["index"] = 1
            elif '-Inner.raw' in f:
                fileDescriptor["name"] = "Inner"
                fileDescriptor["index"] = 2
            elif '_mean3_inverted.raw' in f:
                fileDescriptor["name"] = "Mean3-Inverted"
                fileDescriptor["index"] = 3
                fileDescriptor["rawVolumeChannel"] = True
            elif '-Background.raw' in f:
                fileDescriptor["name"] = "Background"
                fileDescriptor["index"] = 4
                fileDescriptor["background"] = True
            else:
                continue
            output.append(fileDescriptor)

    with open(os.path.join(output_dir_path, "output.json"), "w") as outfile:
        json.dump(output, outfile, indent=2)

    # Clean up
    if args.v and args.c:
        print('Cleaning up the temporary files.')
    if args.c:
        result = os.system('rm -rf ' + str(output_splits_dir_path))
        if result != 0:
            print('Error: Failed to clean up the temporary files.')
