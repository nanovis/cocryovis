from argparse import ArgumentParser
import random

from pytorch_lightning import Trainer, seed_everything, loggers
from pytorch_lightning.callbacks import Callback, EarlyStopping, ModelCheckpoint
from lmodule_transfer_gpus import iUnets3D
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
    # Parameter Parsing
    parser = ArgumentParser('Trains VoReCEM')
    parser.add_argument('train', type=str, help='Path to Training dataset (TorchDataset)')
    parser.add_argument('--seed',  default=260192,     type=int, help='Random Seed')
    parser.add_argument('--qmode', default="always", type=str, help='Queue mode. Either "always" or "onsample".')
    parser.add_argument('--qlen',  default=None,     type=int, help='Maximum Queue length')
    parser.add_argument('--qram',  default=0.5,      type=float, help='Percentage of free RAM to use for queue')
    parser.add_argument('--noq', action='store_true', help='Set True to disable Queue usage and use standard DataLoader instead.')
    parser.add_argument('--precision', default=32,   type=int, help='16 to use Mixed precision (AMP O2), 32 for standard 32 bit float training')
    parser.add_argument('--dev', action='store_true', help='Activate Lightning Fast Dev Run for debugging')
    parser.add_argument('--find_lr', action='store_true', help='Use learning rate finder.')
    parser.add_argument('--overfit', action='store_true', help='If this flag is set the network is overfit to 1 batch')
    parser.add_argument('--accumulate-grads', default=1, type=int, help='Gradient Accumulation to increase batch size. (Multiplicative)')
    parser.add_argument('--min_epochs', default=50, type=int, help='Minimum number of epochs.')
    parser.add_argument('--max_epochs', default=150, type=int, help='Maximum number ob epochs to train')
    parser.add_argument('--run_id', default='test_exp', type=str, help='Run id for logger')
    parser.add_argument('--pretrained', default='none', type=str, help='Path to pretrained model')
    parser.add_argument('--checkpoint', default='none', type=str, help='Path to last checkpoint')
    parser.add_argument('--n_gpus', default=4, type=int, help='Number of GPUs')

    parser = iUnets3D.add_model_specific_args(parser)
    args = parser.parse_args()

    if args.seed is None: # Generate random seed if none is given
        args.seed = random.randrange(4294967295) # Make sure it's logged
    seed_everything(args.seed)

    run_id = args.run_id

    callbacks = [EarlyStopping(monitor='val_loss', min_delta=1e-3, patience=50)]
    # if not args.overfit: callbacks.append(QueueUsageLogging(train_dl.dataset))

    if args.checkpoint == 'none':
        run_name = f'{args.loss}_{run_id}'
    else:
        params_checkpoint = torch.load(args.checkpoint)['hyper_parameters']
        param_loss = params_checkpoint['loss']
        param_model = params_checkpoint['model']
        run_name = f'{param_loss}_{run_id}'

    logger = loggers.WandbLogger(
        project='vorecem',
        name=run_name,
        id=run_id,
        offline=False,
        log_model=True,
        # sync_step=False
    )

    ckpt_cb = ModelCheckpoint(
        dirpath=f'{logger.experiment.dir}/checkpoint',
        filename='{epoch:03d}_{val_loss:.4f}',
        save_top_k=2,
        verbose=True,
        monitor='val_loss',
        save_last=True
    )

    if args.checkpoint == 'none':
        # Setup Model, Logger, Trainer
        fs = get_filesystem(args.pretrained)
        with fs.open(args.pretrained, "rb") as f:
            pretrained_model = torch.load(f, map_location=lambda storage, loc: storage)

        sd = pretrained_model['state_dict']
        shape_final = list(sd['model.final_conv.weight'].shape)
        shape_final[0] = args.out_channels
        sd['model.final_conv.weight'] = torch.rand(shape_final)
        sd['model.final_conv.bias'] = torch.rand(shape_final[0])
        pretrained_model['state_dict'] = sd
        torch.save(pretrained_model, args.pretrained)

        model = iUnets3D.load_from_checkpoint(checkpoint_path=args.pretrained, hparams=args, strict=False)

        trainer = Trainer.from_argparse_args(args,
                                             logger=logger,
                                             track_grad_norm=2,
                                             log_gpu_memory=True,
                                             fast_dev_run=args.dev,
                                             profiler=True,
                                             gpus=args.n_gpus,
                                             auto_select_gpus=True,
                                             accelerator='ddp',
                                             accumulate_grad_batches=args.accumulate_grads,
                                             overfit_batches=1 if args.overfit else 0,
                                             precision=args.precision,
                                             auto_lr_find=args.find_lr,
                                             callbacks=callbacks,
                                             checkpoint_callback=ckpt_cb,
                                             min_epochs=args.min_epochs,
                                             max_epochs=args.max_epochs
                                             )

    else:
        model = iUnets3D.load_from_checkpoint(checkpoint_path=args.checkpoint, hparams=args, strict=False)

        trainer = Trainer.from_argparse_args(args,
                                             logger=logger,
                                             track_grad_norm=2,
                                             log_gpu_memory=True,
                                             fast_dev_run=args.dev,
                                             profiler=True,
                                             gpus=args.n_gpus,
                                             auto_select_gpus=True,
                                             accelerator='ddp',
                                             accumulate_grad_batches=args.accumulate_grads,
                                             overfit_batches=1 if args.overfit else 0,
                                             precision=args.precision,
                                             auto_lr_find=args.find_lr,
                                             callbacks=callbacks,
                                             checkpoint_callback=ckpt_cb,
                                             min_epochs=args.min_epochs,
                                             max_epochs=args.max_epochs,
                                             resume_from_checkpoint=args.checkpoint
                                             )

    # Log random seed
    trainer.logger.log_hyperparams({
        'random_seed': args.seed,
        'gpu_name': torch.cuda.get_device_name(0),
        'gpu_capability': torch.cuda.get_device_capability(0)
    })

    # Fit model
    trainer.fit(model)
    print(f'Best model with loss of {ckpt_cb.best_model_score} saved to {ckpt_cb.best_model_path}')


