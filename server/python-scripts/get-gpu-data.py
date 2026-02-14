import json
import torch


def get_gpu_data():
    # Gather list of all available GPU devices and their properties
    gpu_data = []
    if torch.cuda.is_available():
        num_devices = torch.cuda.device_count()
        for device_id in range(num_devices):
            device_name = torch.cuda.get_device_name(device_id)
            # device_properties = torch.cuda.get_device_properties(device_id)
            gpu_data.append({
                "device_id": device_id,
                "device_name": device_name,
                # "device_properties": device_properties
            })
    return gpu_data


if __name__ == '__main__':
    gpu_info = get_gpu_data()
    print(json.dumps(gpu_info))
