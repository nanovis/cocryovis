from argparse import ArgumentParser
from datetime import datetime
import json
import time
from cryoet_data_portal import Client, Tomogram


class DateTimeEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def fetch_cryoET_tomograms():
    client = Client()
    
    start = time.perf_counter()
    Tomogram.get_by_id(client, 9875)
    print("Time taken: ", time.perf_counter() - start)
    
    start = time.perf_counter()
    Tomogram.get_by_id(client, 9875)
    print("Time taken: ", time.perf_counter() - start)
    
    start = time.perf_counter()
    Tomogram.get_by_id(client, 9875)
    print("Time taken: ", time.perf_counter() - start)
    
    start = time.perf_counter()
    Tomogram.get_by_id(client, 9875)
    print("Time taken: ", time.perf_counter() - start)


if __name__ == '__main__':
    fetch_cryoET_tomograms()
    

