import os
import json
import numpy as np
import torch
import matplotlib.pyplot as plt

from Utils.io import loadSingleMrc, loadJSONVolume

from pathlib import Path
from argparse import ArgumentParser

def showTensor(aTensor):
    plt.figure()
    plt.imshow(aTensor.numpy())
    plt.colorbar()
    plt.show()

def splitVolume(volumeData, save_dir, splitX=0, splitY=512, splitZ=512):
    if splitX == 0:
        splitX = volumeData.size()[0]
        
    if splitX > volumeData.size()[0]:
        splitX = volumeData.size()[0]
    if splitY > volumeData.size()[1]:
        splitY = volumeData.size()[1]
    if splitZ > volumeData.size()[2]:
        splitZ = volumeData.size()[2]

    numX = int(volumeData.size()[0] / splitX)
    numY = int(volumeData.size()[1] / splitY)
    numZ = int(volumeData.size()[2] / splitZ)

    if numX * splitX < volumeData.shape[0]:
        numX += 1
    if numY * splitY < volumeData.shape[1]:
        numY += 1
    if numZ * splitZ < volumeData.shape[2]:
        numZ += 1

    overlapX = (volumeData.size()[0] % splitX) / numX / 2
    overlapY = (volumeData.size()[1] % splitY) / numY / 2
    overlapZ = (volumeData.size()[2] % splitZ) / numZ / 2
    
    if numX > 1:
        overlapX = int((numX * splitX - volumeData.size()[0]) / (numX - 1))
    else:
        overlapX = 0

    if numY > 1:
        overlapY = int((numY * splitY - volumeData.size()[1]) / (numY - 1))
    else:
        overlapY = 0

    if numZ > 1:
        overlapZ = int((numZ * splitZ - volumeData.size()[2]) / (numZ - 1))
    else:
        overlapZ = 0
    
    # print (str(numX) + ' ' + str(numY) + ' ' + str(numZ))
    print (str(overlapX) + ' ' + str(overlapY) + ' ' + str(overlapZ))
    overlap = [overlapX, overlapY, overlapZ]

    startX = 0
    startY = 0
    startZ = 0
    
    endX = splitX - 1
    endY = splitY - 1
    endZ = splitZ - 1

    tile = 0
    split_coords = []

    for i in range(0,numX):
        for j in range(0,numY):
            for k in range(0,numZ):
                print('Saving split #' + str(tile))
                print('Split bounds: [' + str(startX) + ':' + str(endX) + ', ' + str(startY) + ':'+ str(endY) + ', ' + str(startZ) + ':' + str(endZ) + ']')
                torch.save(volumeData[
                        (startX):(endX+1),
                        (startY):(endY+1),
                        (startZ):(endZ+1)], f"{save_dir}/split_{tile}.pt")
                split_coords.append([[startX, endX], [startY, endY], [startZ, endZ]])

                startZ += splitZ - overlapZ
                endZ = startZ + splitZ -1

                tile += 1
            startY += splitY - overlapY
            endY = startY + splitY -1
            startZ = 0
            endZ = splitZ - 1
        startX += splitX - overlapX
        endX = startX + splitX
        startY = 0
        endY = splitY -1
    
    with open(f"{save_dir}/splits.json", "w") as outfile:
        json.dump({
            "overlap" : overlap,
            "split_coords" : split_coords
            }, outfile)                                

if __name__=='__main__':
    parser = ArgumentParser('Splits volume in depth * min(width, 512) * min(height, 512)')
    parser.add_argument('filename', type=str, help='Volume filename')
    parser.add_argument('save_dir', type=str, help='Path to save torch volume dir')
    args = parser.parse_args()
    
    save_dir = Path(args.save_dir)
    if not save_dir.exists(): os.mkdir(save_dir)

    # Load original volume
    if args.filename.endswith(".json") or args.filename.endswith(".JSON"):
        volumeData = loadJSONVolume(args.filename)
    elif args.filename.endswith(".mrc"):
        volumeData, _ = loadSingleMrc(args.filename, normalized=True, cache=True)

    if isinstance(volumeData, np.ndarray):
        volumeData = torch.from_numpy(volumeData)
    splitVolume(volumeData, save_dir)
