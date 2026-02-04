from argparse import ArgumentParser
from pathlib import Path
import wandb

import pytorch_lightning as pl
import torch
from torch import nn as nn
import torch.nn.functional as F

from iunets import iUNet
from iunets.baseline_networks import StandardUNet
from ranger import Ranger

from torchvtk.datasets import TorchDataset, dict_collate_fn
from torchvtk.transforms import Composite, Lambda, RandFlip, Noop, RandRot90
from torchvtk.utils import make_4d

from adaptive_wing_loss import AdaptiveWingLoss, NormalizedReLU
from dense_net import DenseNet
from rsunet import ResidualUNet3D

from transformations import RandCrop

class iUnets3D(pl.LightningModule):
    def __init__(self, hparams):
        super().__init__()

        self.hparams = hparams
#        for key in self.hparams.keys():
#            self.hparams[key]=hparams[key]
#        self.save_hyperparameters(hparams)

        if hparams.last_act == 'nrelu':
            self.act = NormalizedReLU()
        elif hparams.last_act == 'relu':
            self.act = F.relu
        elif hparams.last_act == 'sigmoid':
            self.act = torch.sigmoid
        elif hparams.last_act == 'softmax':
            self.act = torch.nn.Softmax(dim=1)
        elif hparams.last_act == 'none':
            self.act = lambda x: x
        else:
            raise Exception(f'Invalid last activation given ({hparams.last_act}).')

        if hparams.model.lower() == 'unet':
            self.model = nn.Sequential(
                StandardUNet(
                    1, # in_channels
                    base_filters=hparams.feat_ch,
                    dim=3,
                    architecture=[2, 2, 2, 2],
                    skip_connection=True
                )
            )

        elif hparams.model.lower() == 'iunet':
            self.model = nn.Sequential(
                nn.Conv3d(1, hparams.feat_ch, 1, 1),
                iUNet(
                    hparams.feat_ch, # in_channels
                    dim=3,
                    architecture=[2, 2, 2],
                    module_kwargs={'block_depth': 3},
                    # padding_mode='reflect',
                    # verbose=1
                ),
                nn.Conv3d(hparams.feat_ch, 1, 1)
            )
        elif hparams.model.lower() == 'dense':
            self.model = DenseNet(num_init_features=32, growth_rate=16, block_config=(4, 4, 4, 4), drop_rate=0.2, num_classes=2)
        elif hparams.model.lower() == 'rsunet':
            f_maps = hparams.feat_ch
            self.model = ResidualUNet3D(in_channels=1, out_channels=hparams.out_channels, f_maps=f_maps, num_groups=2, is_segmentation=False)
        else:
            raise Exception(f"Invalid model parameter: {hparams.model}. Either unet or iunet")

        if self.hparams.loss == 'bce':
            self.loss = F.binary_cross_entropy_with_logits
        elif self.hparams.loss == 'awl':
            self.loss = AdaptiveWingLoss(omega=8)
        elif self.hparams.loss == 'mse':
            self.loss = F.mse_loss
        elif self.hparams.loss == 'cross':
            self.loss = nn.CrossEntropyLoss()
        else:
            raise Exception(f'Unknown loss given: {self.hparams.loss}')

        self.metrics = pl.metrics.F1(num_classes=hparams.out_channels)

        self.save_hyperparameters()

#        print(self.model)

    def forward(self, x):
        return self.act(self.model(x))

###
### TRAINING
###

    def training_step(self, batch, batch_idx):
        vol = batch['vol']
        targ = batch['label']
        pred = self.forward(vol)

        targ_squeeze = torch.squeeze(targ, 1)
        loss = self.loss(pred, targ_squeeze)

        with torch.no_grad():
            train_f1 = self.metrics(pred, targ_squeeze)
            self.log('train_f1', train_f1)

        self.log('train_loss', loss.detach())

        pred_mask = torch.argmax(pred, dim=1, keepdim=True)

        if batch_idx == 0:
            pred_mask = torch.mul(pred_mask, 85.)
            targ_mask = torch.mul(targ, 85.)
            if self.logger:
                self.logger.experiment.log({
                    'train/Predictions': wandb.Image(pred_mask[2, :, self.hparams.tile_sz // 2, :]),
                    'train/Targets': wandb.Image(targ_mask[2, :, self.hparams.tile_sz // 2, :]),
                })

        return {
            'loss': loss,
            'f1_score': train_f1
        }

    def training_epoch_end(self, values):
        avg_loss = torch.stack([v['loss'] for v in values]).mean()
        avg_f1 = torch.stack([v['f1_score'] for v in values]).mean()

        self.log('metrics/train_loss', avg_loss)
        self.log('metrics/train_f1_score', avg_f1)


###
### VALIDATION
###

    def validation_step(self, batch, batch_idx):
        vol = batch['vol']
        targ = batch['label']
        pred = self.forward(vol)

        targ_squeeze = torch.squeeze(targ, 1)
        loss = self.loss(pred, targ_squeeze)
        val_f1 = self.metrics(pred, targ_squeeze)

        self.log('val_loss', loss)
        self.log('val_f1', val_f1)

        print(f'\nValid --- Target ({targ.shape}) is {targ.dtype} with min/max {targ.min(), targ.max()}')
        print(f'\nValid --- Pred ({pred.shape}) is {pred.dtype} with min/max {pred.min(), pred.max()}')
        print(f'\nValid --- Target squeeze ({targ_squeeze.shape}) is {targ_squeeze.dtype} with min/max {targ_squeeze.min(), targ_squeeze.max()}')
        print(f'\nNGAN: val_f1: {val_f1}')

        pred = F.softmax(pred, dim=1)
        pred_mask = torch.argmax(pred, dim=1, keepdim=True)

        if batch_idx == 0:
            pred_mask = torch.mul(pred_mask, 85.)
            targ_mask = torch.mul(targ, 85.)
            if self.logger:
                self.logger.experiment.log({
                    'valid/Predictions': wandb.Image(pred_mask[2, :, self.hparams.tile_sz // 2, :]),
                    'valid/Targets': wandb.Image(targ_mask[2, :, self.hparams.tile_sz // 2, :]),
                })

        return {
            'loss': loss,
            'f1_score': val_f1
        }

    def validation_epoch_end(self, values):
        avg_loss = torch.stack([v['loss'] for v in values]).mean()
        avg_f1 = torch.stack([v['f1_score'] for v in values]).mean()

        self.log('metrics/val_loss', avg_loss)
        self.log('metrics/val_f1_score', avg_f1)

###
### TEST
###

    def test_step(self, batch, batch_idx):
        vol = batch['vol']
        # targ = batch['label']
        pred = self.forward(vol)

        # targ_squeeze = torch.squeeze(targ, 1)
        # loss = self.loss(pred, targ_squeeze)

        pred_prob = F.softmax(pred, dim=1)
        pred_mask = torch.argmax(pred, dim=1, keepdim=True)
        # test_f1 = self.metrics(pred_mask, targ)

        if batch_idx == 0:
            pred_mask = torch.mul(pred_mask, 85.)
            # targ_mask = torch.mul(targ, 85.)
            if self.logger:
                self.logger.experiment.log({
                    'test/Predictions': wandb.Image(pred_mask[0, :, self.hparams.tile_sz // 2, :]),
                    # 'test/Targets': wandb.Image(targ_mask[0, :, self.hparams.tile_sz // 2, :]),
                })

        # self.log('test_loss', loss)
        # self.log('test_f1', test_f1)

        return {
            # 'loss': loss,
            # 'f1_score': test_f1,
            'pred_prob': pred_prob,
            # 'targ': targ,
            'tile_locations': batch['tile_locations']
        }

    def test_epoch_end(self, values):
        # avg_loss = torch.stack([v['loss'] for v in values]).mean()
        # avg_f1 = torch.stack([v['f1_score'] for v in values]).mean()
        #
        # self.log('metrics/test_loss', avg_loss)
        # self.log('metrics/test_f1_score', avg_f1)

        # path_test = Path(self.hparams.train) / 'test'
        # path_predict = Path(self.hparams.train) / 'predictions'
        # files = list(path_test.rglob('*.pt'))
        # file0 = Path(files[0])
        file0 = Path(self.hparams.path)
        # print('tuki 1')
        # if hasattr(self.hparams, 'file_name'):
        #     print("tuki 2")
        #     file0 = Path(self.hparams.file_name)
        predictions = torch.cat([v['pred_prob'] for v in values], dim=0)
        # torch.save(predictions, f'{path_predict}/{file0.stem}_predictions.pt')
        torch.save(predictions, f'{self.hparams.output_path}/{file0.stem}_predictions.pt')

        tile_locations = torch.cat([v['tile_locations'] for v in values], dim=0)
        # torch.save(tile_locations, f'{path_predict}/{file0.stem}_tile_locations.pt')
        torch.save(tile_locations, f'{self.hparams.output_path}/{file0.stem}_tile_locations.pt')

        # labels = torch.cat([v['targ'] for v in values], dim=0)
        # torch.save(labels, f'labels.pt')


###
### TRANSFORMS
###

    def train_transforms(self):
        dtype = torch.float16 if self.hparams.precision == 16 else torch.float32
        dtype_label = torch.long
        return Composite(
            Lambda(make_4d),
            RandCrop(self.hparams.tile_sz, apply_on=['vol', 'label'], dtype=dtype),
            # RandRot90(ndim=3, apply_on=['vol', 'label']),
            RandFlip(apply_on=['vol', 'label']),
            Noop(dtype=dtype, apply_on=['vol']),
            Noop(dtype=dtype_label, apply_on=['label']),
            apply_on=['vol', 'label'],
        )

    def valid_transforms(self):
        dtype = torch.float16 if self.hparams.precision == 16 else torch.float32
        dtype_label = torch.long
        return Composite(
            Lambda(make_4d),
            RandCrop(self.hparams.tile_sz, apply_on=['vol', 'label'], dtype=dtype),
            Noop(dtype=dtype, apply_on=['vol']),
            Noop(dtype=dtype_label, apply_on=['label']),
            apply_on=['vol', 'label']
        )

    def test_transforms(self):
        dtype = torch.float16 if self.hparams.precision == 16 else torch.float32
        dtype_label = torch.long
        return Composite(
            Lambda(make_4d),
            Noop(dtype=dtype, apply_on=['vol']),
            # Noop(dtype=dtype_label, apply_on=['label']),
            # apply_on=['vol', 'label']
            apply_on=['vol']
        )

###
### DATA
###

    def train_dataloader(self):
        datasets = []
        for i in range(self.hparams.n_blocks):
            datasets.append(TorchDataset(Path(self.hparams.train) / 'train', preprocess_fn=self.train_transforms()))
        train_ds = torch.utils.data.ConcatDataset(datasets)

        return torch.utils.data.DataLoader(train_ds,
                                           batch_size=self.hparams.batch_size,
                                           pin_memory=True,
                                           collate_fn=dict_collate_fn,
                                           shuffle=True)

    def val_dataloader(self):
        valid_ds = TorchDataset(Path(self.hparams.train)/'valid', preprocess_fn=self.valid_transforms())

        return torch.utils.data.DataLoader(valid_ds,
                                           batch_size=self.hparams.batch_size,
                                           pin_memory=True,
                                           collate_fn=dict_collate_fn)


    def test_dataloader(self):
        # test_ds = TorchDataset(Path(self.hparams.train)/'test', preprocess_fn=self.test_transforms()).preload()\
        #     .tile(['vol', 'label'], tile_sz=self.hparams.tile_sz, overlap=self.hparams.tile_overlap)
        # test_ds = TorchDataset(Path(self.hparams.train) / 'test', preprocess_fn=self.test_transforms()).preload() \
        #     .tile(['vol'], tile_sz=self.hparams.tile_sz, overlap=self.hparams.tile_overlap)
        test_ds = TorchDataset([Path(self.hparams.path)], preprocess_fn=self.test_transforms()).preload() \
            .tile(['vol'], tile_sz=self.hparams.tile_sz, overlap=self.hparams.tile_overlap)

#        for tile in test_ds:
#            print(f"\nNGAN: {tile['tile_locations']}")
        # print(test_ds)
        return torch.utils.data.DataLoader(test_ds,
                                           batch_size=self.hparams.batch_size,
                                           pin_memory=True,
                                           collate_fn=dict_collate_fn)

###
### Helper functions
###
    def set_additional_attribute(self, arg_name, arg):
        self.hparams[arg_name] = arg

###
### OPTIMIZER & PARSER
###

    def configure_optimizers(self):
        if self.hparams.opt.lower() == 'ranger':
            opt = Ranger(self.parameters(), weight_decay=self.hparams.weight_decay, eps=1e-3)
        elif self.hparams.opt.lower() == 'adam':
            opt = torch.optim.Adam(self.parameters(), weight_decay=self.hparams.weight_decay, eps=1e-3)
        else:
            raise Exception(f'Invalid optimizer given: {self.hparams.opt}')
        sched = torch.optim.lr_scheduler.ReduceLROnPlateau(opt, factor=0.5)
        return {
            'optimizer': opt,
            'lr_scheduler': sched,
            'monitor': 'val_loss'
        }

    @staticmethod
    def add_model_specific_args(parent_parser):
        parser = ArgumentParser(parents=[parent_parser], add_help=False)
        parser.add_argument('--learning_rate', default=1e-3, type=float, help='Learning Rate')
        parser.add_argument('--weight_decay',  default=1e-4, type=float, help='Weight decay for training.')
        parser.add_argument('--batch_size',    default=4,     type=int,   help='Batch Size')
        parser.add_argument('--opt', type=str, default='Adam', help='Optimizer to use. One of Ranger, Adam')
        parser.add_argument('--bin_thresh', type=float, default=0.5, help='Threshold for binarizing predictions')
        parser.add_argument('--loss', type=str, default='cross', help="The loss to use. Either bce or awl")
        parser.add_argument('--model', type=str, default='rsunet', help='Model to train. Either UNet or iUNet. (Not case sensitive)')
        parser.add_argument('--feat_ch', type=int, default=4, help='The number of feature channels that the network starts with (the number that doubles with deacreased spatial downsampling')
        parser.add_argument('--tile_sz', type=int, default=128, help='Tile / Bricking size during training, validation and test')
        parser.add_argument('--tile_overlap', type=int, default=32, help='Overlap of the input tiles/bricks')
        parser.add_argument('--last_act', type=str, default='none', help='Last activation function. Otions: nrelu, relu, sigmoid, none')
        parser.add_argument('--n_blocks', type=int, default=100, help='Number of random blocks per chunk for training data')
        parser.add_argument('--out_channels', type=int, default=4, help='Number of out channels')

        return parser
