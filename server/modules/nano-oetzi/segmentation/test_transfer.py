from argparse import ArgumentParser
from pytorch_lightning import Trainer, seed_everything, loggers
from lmodule_transfer import iUnets3D
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
    parser.add_argument('test_file_path', type=str, help='Path to Training dataset file (TorchDataset)')
    parser.add_argument('--checkpoint', type=str, help='Path to pretrained model')
    parser.add_argument('--precision', default=16, type=int, help='16 to use Mixed precision (AMP O2), 32 for standard 32 bit float training')
    parser.add_argument('--seed', default=None, type=int, help='Random Seed')
    parser.add_argument('--wandb', default=False, type=bool, help='Wandb logging')
    parser.add_argument('--output_path', type=str, default='', help='Output path of inference')

    parser = iUnets3D.add_model_specific_args(parser)
    args = parser.parse_args()

    if args.seed is None: # Generate random seed if none is given
        args.seed = random.randrange(4294967295) # Make sure it's logged
    seed_everything(args.seed)

    # Setup Model, Logger, Trainer
    fs = get_filesystem(args.checkpoint)
    with fs.open(args.checkpoint, "rb") as f:
        checkpoint = torch.load(args.checkpoint, map_location=lambda storage, loc: storage)
        checkpoint['hyper_parameters']['hparams'].train = args.test_file_path
        torch.save(checkpoint, args.checkpoint)

    model = iUnets3D.load_from_checkpoint(checkpoint_path=args.checkpoint, strict=False)
    model.set_additional_attribute('path', args.test_file_path)
    model.set_additional_attribute('output_path', args.output_path)

    run_id = model.hparams.run_id

    # logger = loggers.WandbLogger(
    #     project='vorecem',
    #     name=f'{model.hparams.loss}_{run_id}',
    #     id=run_id,
    #     offline=False,
    #     log_model=True,
    #     # sync_step=False
    # )
    #
    # wandb.init(id=run_id, project='vorecem', resume='must', name=f'{model.hparams.loss}_{run_id}')

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

