from argparse import ArgumentParser
from datetime import datetime
import json
from cryoet_data_portal import Client, Tomogram


class DateTimeEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def fetch_cryoET_tomograms(id: int):
    client = Client()
    tomograpm = Tomogram.get_by_id(client, id)
    print(json.dumps(tomograpm.to_dict(), cls=DateTimeEncoder))


if __name__ == '__main__':
    parser = ArgumentParser('Fetch cryoET tomogram metadata by id')
    parser.add_argument('id', type=int, help='ID of the tomogram.')
    args = parser.parse_args()

    fetch_cryoET_tomograms(args.id)
