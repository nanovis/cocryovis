from argparse import ArgumentParser
from pytorch_lightning import Trainer, seed_everything, loggers
from lmodule import iUnets3D
import random
import wandb
import torch
from pathlib import Path
from typing import Union
import fsspec

def get_filesystem(path: Union[str, Path]):
    path = str(path)
    if "://" in path:
        # use the fileystem from the protocol specified
        return fsspec.filesystem(path.split(":", 1)[0])
    else:
        # use local filesystem
        return fsspec.filesystem("file")

if __name__=='__main__':
    # Paramter Parsing
    parser = ArgumentParser('Trains VoReCEM')
    parser.add_argument('test', type=str, help='Path to Training dataset (TorchDataset)')
    parser.add_argument('--checkpoint', type=str, help='Path to pretrained model')
    parser.add_argument('--precision', default=16, type=int, help='16 to use Mixed precision (AMP O2), 32 for standard 32 bit float training')
    parser.add_argument('--seed', default=None, type=int, help='Random Seed')
    parser.add_argument('--run_id', default='test_exp', type=str, help='Run id for logger')

    args = parser.parse_args()

    if args.seed is None: # Generate random seed if none is given
        args.seed = random.randrange(4294967295) # Make sure it's logged
    seed_everything(args.seed)

    fs = get_filesystem(args.checkpoint)
    with fs.open(args.checkpoint, "rb") as f:
        checkpoint = torch.load(args.checkpoint, map_location=lambda storage, loc: storage)
        checkpoint['hyper_parameters']['hparams'].train = args.test
        torch.save(checkpoint, args.checkpoint)
    # Setup Model, Logger, Trainer
    model = iUnets3D.load_from_checkpoint(checkpoint_path=args.checkpoint, strict=False)

    run_id = args.run_id

    # logger = loggers.WandbLogger(
    #     project='vorecem',
    #     name=f'{model.hparams.loss}_{run_id}',
    #     id=run_id,
    #     offline=False,
    #     log_model=True,
    #     # sync_step=False
    # )

    # wandb.init(id=run_id, project='vorecem', name=f'{model.hparams.loss}_{run_id}')

    trainer = Trainer.from_argparse_args(args,
        # logger=logger,
        logger=False,
        track_grad_norm=2,
        log_gpu_memory=True,
        profiler=True,
        gpus=1,
    )

    # Testing
    trainer.test(model)

