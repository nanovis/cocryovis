import torch
import torch.nn.functional as F
from torchvtk.transforms import DictTransform
from torchvtk.utils import make_nd

class RandCropResize(DictTransform):
    def __init__(self, min_tile_sz, dim=3, resize_mode='trilinear', **kwargs):
        super().__init__(**kwargs)
        if isinstance(min_tile_sz, (tuple, list)):
            self.min_tile_sz = torch.LongTensor(min_tile_sz)
        else:
            self.min_tile_sz = torch.LongTensor([min_tile_sz] * dim)
        self.dim = dim
        self.mode = resize_mode

    def transform(self, items):
        # Shape of chunk file
        shap = torch.LongTensor(list(items[0].shape[-self.dim:]))
        # min_tile_sz: Size of tile
        # tile_sz: Random tile size
        tile_sz = torch.randint(self.min_tile_sz[-1], shap.min().item(), (1,)).expand(self.dim)
        begin = torch.floor(torch.rand((self.dim,)) * (shap - tile_sz)).long()
        end = begin + tile_sz
        idx = [slice(None, None)]*(items[0].ndim-self.dim) + [slice(b, e) for b, e in zip(begin.tolist(), end.tolist())]
        # Downscale to 1:1:1
        return [F.interpolate(make_nd(item[idx], self.dim+2), size=self.min_tile_sz.tolist(), mode=self.mode).squeeze(0) for item in items]


class RandCrop(DictTransform):
    def __init__(self, tile_sz, dim=3, **kwargs):
        super().__init__(**kwargs)
        if isinstance(tile_sz, (tuple, list)):
            self.tile_sz = torch.LongTensor(tile_sz)
        else:
            self.tile_sz = torch.LongTensor([tile_sz] * dim)
        self.dim = dim

    def transform(self, items):
        # Shape of chunk file
        shap = torch.LongTensor(list(items[0].shape[-self.dim:]))
        # tile_sz: Size of tile
        begin = torch.floor(torch.rand((self.dim,)) * (shap - self.tile_sz)).long()
        end = begin + self.tile_sz
        idx = [slice(None, None)]*(items[0].ndim-self.dim) + [slice(b, e) for b, e in zip(begin.tolist(), end.tolist())]
        return [item[idx] for item in items]
