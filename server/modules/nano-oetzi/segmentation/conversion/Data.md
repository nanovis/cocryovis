## Convert Data to PyTorch tensors
The `convert_to_torch.py` script converts the original dataset to serialized PyTorch tensors. This makes them easy and fast to load during neural network training. The tensors are saved in the following format:
```
{
    'vol': torch.Tensor of shape (Z, Y, X), original dtype
    'label': torch.Tensor, same shape as vol, uint8
    'phys_dims': torch.Tensor of shape (3,) with physical volume dimensions, given as X, Y, Z (from mrc header cella)
    'name': The name of the mrc file
}
```
The data can be load using `data = torch.load('filename.pt')` and accessed like a dictionary: `data['vol']`

### Python Setup
Any Python3 setup with the following packages should do:
```
pip install torch torchvision mrcfile
```
(Python 3.8.5, torch 1.6.0 approved)

### Manual dataset adoption
In the original dataset, you may need to rename
```
Beata/230_bin4_dn/230_bin4_dn_Foreground_u8bit/
```
to
```
Beata/230_bin4_dn/230_bin4_dn_Foreground_0.08_u8bit/
```
in order for it to be found. Use `-dryrun` to see a list of volume/label pairs that is found.

### Running the script
See `convert_to_torch.py`'s argparse arguments. Having the script in the VoReCEM data folder, you can probably just run:
```
python ./convert_to_torch.py . ./torch
```
Use the `-dryrun` argument to see what will be done (without writing)



## Note
Currently 4-layer volume unused!!
