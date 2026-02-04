from fileinput import filename
import os
import re

from argparse import ArgumentParser

def rename(path, old_name, new_name):
    os.rename(path + old_name, path + new_name)

if __name__=='__main__':
    parser = ArgumentParser('Renames files according to input/output pattern')
    parser.add_argument('path', type=str, help='Path to files')
    parser.add_argument('input_pattern', type=str, help='Input file name pattern where ? defines number')
    parser.add_argument('output_pattern', type=str, help='Output file name patthern where ? defines number')
    args = parser.parse_args()
    
    path = args.path
    files = os.listdir(path)
    for f in files:
        # print(f)
        q = args.input_pattern.find('?')
        input_prefix = args.input_pattern[0:q]
        input_postfix = args.input_pattern[q+1:len(args.input_pattern)]

        q = args.output_pattern.find('?')
        output_prefix = args.output_pattern[0:q]
        if q < len(args.output_pattern):
            output_postfix = args.output_pattern[q+1:len(args.output_pattern)]

        if f.startswith(input_prefix) and f.endswith(input_postfix):
            result = re.search(input_prefix + '(.*)' + input_postfix, f)
            new_name = output_prefix + result.group(1) + output_postfix
            print("Renamed file: " + f + " to: " + new_name)
            rename(path, f, new_name)