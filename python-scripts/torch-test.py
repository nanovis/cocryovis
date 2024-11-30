import torch
import matplotlib

if __name__ == '__main__':
    print("Is Cuda available?", torch.cuda.is_available())
    print("CUDA version", torch.version.cuda)
    print("CUDA device count:", torch.cuda.device_count())
    cuda_device = torch.cuda.current_device()
    print(f"Current CUDA device: {torch.cuda.get_device_name(cuda_device)} ({cuda_device})")