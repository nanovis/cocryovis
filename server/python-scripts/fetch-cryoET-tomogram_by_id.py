from argparse import ArgumentParser
from datetime import datetime
import json
import sys
import numpy as np
from cryoet_data_portal import Client, Tomogram

UINT32_MAX = np.iinfo(np.uint32).max


class DateTimeEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def fetch_cryoET_tomograms(id: int):
    if id < 0 or id > UINT32_MAX:
        print(f'Invalid tomogram ID {id}.', file=sys.stderr)
        sys.exit(1)

    try:
        client = Client()
    except Exception as e:
        print(f'Could not connect to cryoET API client.', file=sys.stderr)
        sys.exit(1)

    try:
        tomogram = Tomogram.get_by_id(client, id)
    except Exception as e:
        print(f'Could not fetch tomogram with id {id}.', file=sys.stderr)
        sys.exit(1)

    if not tomogram:
        print(f'Tomogram with id {id} does not exist.', file=sys.stderr)
        sys.exit(1)

    try:
        print(json.dumps(tomogram.to_dict(), cls=DateTimeEncoder))
    except Exception as e:
        print(f'Could not serialize tomogram to JSON.', file=sys.stderr)


if __name__ == '__main__':
    parser = ArgumentParser('Fetch cryoET tomogram metadata by id')
    parser.add_argument('id', type=int, help='ID of the tomogram.')
    args = parser.parse_args()

    fetch_cryoET_tomograms(args.id)
