import torch
import matplotlib.pyplot as plt

overlap_size = 32
block_size = 128

# max_locations = [0, 0, 0]
# min_locations = [340, 1408, 1008]

# Volume init
volume_size = [360, 1440, 1024]


# Find block limits in volume:
def find_block_limits(locations, min_locations, max_locations):
    for i in locations:
        for k in i:
            if k[0].item() > max_locations[0]:
                max_locations[0] = k[0].item()

            if k[1].item() > max_locations[1]:
                max_locations[1] = k[1].item()

            if k[2].item() > max_locations[2]:
                max_locations[2] = k[2].item()

            if k[0].item() < min_locations[0]:
                min_locations[0] = k[0].item()

            if k[1].item() < min_locations[1]:
                min_locations[1] = k[1].item()

            if k[2].item() < min_locations[2]:
                min_locations[2] = k[2].item()

# Find block limits in volume:
def find_block_limits_2(locations, min_locations, max_locations):
    for i in locations:
        for j in i:
            for k in j:
                if k[0].item() > max_locations[0]:
                    max_locations[0] = k[0].item()

                if k[1].item() > max_locations[1]:
                    max_locations[1] = k[1].item()

                if k[2].item() > max_locations[2]:
                    max_locations[2] = k[2].item()

                if k[0].item() < min_locations[0]:
                    min_locations[0] = k[0].item()

                if k[1].item() < min_locations[1]:
                    min_locations[1] = k[1].item()

                if k[2].item() < min_locations[2]:
                    min_locations[2] = k[2].item()

# Find block limits in volume:
def find_block_limits_3(locations, min_locations, max_locations):
    i = locations[0, 0]
    # for i in locations:
    for j in i:
        for k in j:
            if k[0].item() > max_locations[0]:
                max_locations[0] = k[0].item()

            if k[1].item() > max_locations[1]:
                max_locations[1] = k[1].item()

            if k[2].item() > max_locations[2]:
                max_locations[2] = k[2].item()

            if k[0].item() < min_locations[0]:
                min_locations[0] = k[0].item()

            if k[1].item() < min_locations[1]:
                min_locations[1] = k[1].item()

            if k[2].item() < min_locations[2]:
                min_locations[2] = k[2].item()

# Non-overlapping parts of blocks:
def non_overlapping_parts(blocks, volume, locations, min_locations, max_locations):
    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        for nblock in range(blocks.size()[1]):
            print('block: ' + str(nblock))
            block = blocks[nbatch][nblock][0]
            loc_0 = locations[nbatch][nblock][0]
            loc_1 = locations[nbatch][nblock][1]
            volume[loc_0[0] + 32:loc_1[0] - 32, loc_0[1] + 32:loc_1[1] - 32, loc_0[2] + 32:loc_1[2] - 32] = block[32:96, 32:96, 32:96]

            if loc_0[0] == min_locations[0]:
                volume[loc_0[0]:loc_0[0] + 32, loc_0[1] + 32:loc_1[1] - 32, loc_0[2] + 32:loc_1[2] - 32] = block[0:32, 32:96, 32:96]
            if loc_0[1] == min_locations[1]:
                volume[loc_0[0] + 32:loc_1[0] - 32, loc_0[1]:loc_0[1] + 32, loc_0[2] + 32:loc_1[2] - 32] = block[32:96, 0:32, 32:96]
            if loc_0[2] == min_locations[2]:
                volume[loc_0[0] + 32:loc_1[0] - 32, loc_0[1] + 32:loc_1[1] - 32, loc_0[2]:loc_0[2] + 32] = block[32:96, 32:96, 0:32]
            if loc_1[0] == max_locations[0]:
                volume[loc_1[0] - 32:loc_1[0], loc_0[1] + 32:loc_1[1] - 32, loc_0[2] + 32:loc_1[2] - 32] = block[96:128, 32:96, 32:96]
            if loc_1[1] == max_locations[1]:
                volume[loc_0[0] + 32:loc_1[0] - 32, loc_1[1] - 32:loc_1[1], loc_0[2] + 32:loc_1[2] - 32] = block[32:96, 96:128, 32:96]
            if loc_1[2] == max_locations[2]:
                volume[loc_0[0] + 32:loc_1[0] - 32, loc_0[1] + 32:loc_1[1] - 32, loc_1[2] - 32:loc_1[2]] = block[32:96, 32:96, 96:128]

            volume[loc_0[0] + 32:loc_1[0] - 32, loc_0[1] + 32:loc_1[1] - 32, loc_0[2] + 32:loc_1[2] - 32] = block[32:96, 32:96, 32:96]


# Mask volume for averaging on overlaps
def average_by_masking_stitchin(blocks, volume, mask_volume, locations):
    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        for nblock in range(blocks.size()[1]):
            print('block: ' + str(nblock))
            block = blocks[nbatch][nblock][0]
            loc_0 = locations[nbatch][nblock][0]
            loc_1 = locations[nbatch][nblock][1]
            mask_volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += 1.0

    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        for nblock in range(blocks.size()[1]):
            print('block: ' + str(nblock))
            block = blocks[nbatch][nblock][0]
            loc_0 = locations[nbatch][nblock][0]
            loc_1 = locations[nbatch][nblock][1]
            volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] = block.to(device="cpu") * (1 / mask_volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]])


# Alpha blending
def alpha_blended_stitching(blocks, volume, locations, min_locations, max_locations, block_size, overlap_size):
    mask_block = torch.ones(block_size, block_size, block_size)
    for i in range(overlap_size):
        mask_block[i, :, :] *= i / overlap_size
        mask_block[:, i, :] *= i / overlap_size
        mask_block[:, :, i] *= i / overlap_size
        mask_block[-i-1, :, :] *= i / overlap_size
        mask_block[:, -i-1, :] *= i / overlap_size
        mask_block[:, :, -i-1] *= i / overlap_size

    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        for nblock in range(blocks.size()[1]):
            block = blocks[nbatch, nblock, 0]
            loc_0 = locations[nbatch, nblock, 0]
            loc_1 = locations[nbatch, nblock, 1]
            # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += mask_block
            volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += block.to(device="cpu") * mask_block

    for i in range(1, overlap_size):
        volume[min_locations[0] + i, :, :] /= i / overlap_size
        volume[:, min_locations[1] + i, :] /= i / overlap_size
        volume[:, :, min_locations[2] + i] /= i / overlap_size
        volume[max_locations[0] - i, :, :] /= i / overlap_size
        volume[:, max_locations[1] - i, :] /= i / overlap_size
        volume[:, :, max_locations[2] - i] /= i / overlap_size

def fix_border(volume, min_locations, max_locations):
    volume[:min_locations[0], :, :] = 0.0
    volume[max_locations[0]:, :, :] = 0.0
    volume[:, min_locations[1], :] = 0.0
    volume[:, max_locations[1]:, :] = 0.0
    volume[:, :, min_locations[2]:] = 0.0
    volume[:, :, max_locations[2]:] = 0.0

def alpha_blended_stitching_all_class(blocks, volume, locations, min_locations, max_locations, block_size, overlap_size, class_num):
    mask_block = torch.ones(block_size, block_size, block_size)
    for i in range(overlap_size):
        mask_block[i, :, :] *= i / overlap_size
        mask_block[:, i, :] *= i / overlap_size
        mask_block[:, :, i] *= i / overlap_size
        mask_block[-i-1, :, :] *= i / overlap_size
        mask_block[:, -i-1, :] *= i / overlap_size
        mask_block[:, :, -i-1] *= i / overlap_size

    limit1 = locations.size()[0]
    limit2 = locations.size()[1]
    for nbatch in range(limit2):
        # print('nbatch: ' + str(nbatch))
        # print('batch: ' + str(nbatch) + '/' + str(blocks.size()[0]))
        block = blocks[nbatch, class_num]
        # print('nbatch: ' + str(nbatch) + ' nbatchMlimit2: ' + str(nbatch % limit2))
        # print('')
        loc_0 = locations[0, nbatch, 0]
        loc_1 = locations[0, nbatch, 1]
        # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += mask_block
        volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += block.to(device="cpu") * mask_block
        # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] = block.to(device="cpu")

    for i in range(1, overlap_size):
        volume[min_locations[0] + i, :, :] /= i / overlap_size
        volume[:, min_locations[1] + i, :] /= i / overlap_size
        volume[:, :, min_locations[2] + i] /= i / overlap_size
        volume[max_locations[0] - i - 1, :, :] /= i / overlap_size
        volume[:, max_locations[1] - i - 1, :] /= i / overlap_size
        volume[:, :, max_locations[2] - i - 1] /= i / overlap_size

def alpha_blended_stitching_all_class_2(blocks, volume, locations, min_locations, max_locations, block_size, overlap_size, class_num):
    mask_block = torch.ones(block_size, block_size, block_size)
    for i in range(overlap_size):
        mask_block[i, :, :] *= i / overlap_size
        mask_block[:, i, :] *= i / overlap_size
        mask_block[:, :, i] *= i / overlap_size
        mask_block[-i-1, :, :] *= i / overlap_size
        mask_block[:, -i-1, :] *= i / overlap_size
        mask_block[:, :, -i-1] *= i / overlap_size

    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        for batch_size in range(blocks.size()[1]):
            print('batch_#: ' + str(batch_size))
            block = blocks[nbatch, batch_size, class_num]
            # loc_0 = locations[nbatch, batch_size, nbatch * batch_size, 0]
            # loc_1 = locations[nbatch, batch_size, nbatch * batch_size, 1]
            loc_0 = locations[0, 0, nbatch * blocks.size()[1] + batch_size, 0]
            loc_1 = locations[0, 0, nbatch * blocks.size()[1] + batch_size, 1]
            # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += mask_block
            volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += block.to(device="cpu") * mask_block
            # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] = block.to(device="cpu")

    for i in range(1, overlap_size):
        volume[min_locations[0] + i, :, :] /= i / overlap_size
        volume[:, min_locations[1] + i, :] /= i / overlap_size
        volume[:, :, min_locations[2] + i] /= i / overlap_size
        volume[max_locations[0] - i, :, :] /= i / overlap_size
        volume[:, max_locations[1] - i, :] /= i / overlap_size
        volume[:, :, max_locations[2] - i] /= i / overlap_size

def alpha_blended_stitching_all_class_labels(blocks, volume, locations, min_locations, max_locations, block_size, overlap_size):
    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        block = blocks[nbatch, 0]
        loc_0 = locations[nbatch, nbatch, 0]
        # print(loc_0)
        loc_1 = locations[nbatch, nbatch, 1]
        # print(loc_1)
        # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += mask_block
        # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += block.to(device="cpu") * mask_block
        volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] = block.to(device="cpu")

def alpha_blended_stitching_all_class_labels_2(blocks, volume, locations, min_locations, max_locations, block_size, overlap_size):
    for nbatch in range(blocks.size()[0]):
        print('batch: ' + str(nbatch))
        block = blocks[nbatch, 0, 0]
        loc_0 = locations[nbatch, 0, 0, 0]
        # print(loc_0)
        loc_1 = locations[nbatch, 0,  0, 1]
        # print(loc_1)
        # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += mask_block
        # volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] += block.to(device="cpu") * mask_block
        volume[loc_0[0]:loc_1[0], loc_0[1]:loc_1[1], loc_0[2]:loc_1[2]] = block.to(device="cpu")

# Display slice from selected volume
def display_volume_slice(volume, slice):
    fig, ax = plt.subplots()
    im = ax.imshow((volume[slice]))
    plt.show()

# Display slices from selected volumes as RGB
def display_volumes_slice(volume1, volume2, volume3, slice):
    fig, ax = plt.subplots()
    # im = ax.imshow((volume[slice]))
    im = ax.imshow(torch.stack((volume1[slice], volume2[slice], volume3[slice]), 2))
    plt.show()

# Display slice from selected volume
def display_volume_slice_tr_val_tst(tnsr, slice):
    fig, ax = plt.subplots(1, 2)
    ax[0].imshow((tnsr['vol'][slice]))
    ax[0].title.set_text('Prediction')
    ax[1].imshow((tnsr['label'][slice]))
    ax[1].title.set_text('Label')
    plt.show()


# Volume slice comparison
def display_volume_slice_comparison(volume, labels_volume, slice):
    fig, ax = plt.subplots(1, 2)
    ax[0].imshow((volume[slice]))
    ax[0].title.set_text('Orig')
    ax[1].imshow((labels_volume[slice]))
    ax[1].title.set_text('Label')
    plt.show()

# 4-class volume slice comparison
def display_volume_slice_comparison_all_class(volume_0, volume_1, volume_2, volume_3, slice):
    fig, ax = plt.subplots(2, 2)
    ax[0,0].imshow((volume_0[slice]))
    ax[0,0].title.set_text('Background')
    ax[1,0].imshow((volume_1[slice]))
    ax[1,0].title.set_text('Membrane')
    ax[0,1].imshow((volume_2[slice]))
    ax[0,1].title.set_text('Spikes')
    ax[1,1].imshow((volume_3[slice]))
    ax[1,1].title.set_text('Inner')
    plt.show()

# 4-class volume slice comparison
def display_volume_slice_comparison_all_class_labels(volume_0, volume_1, volume_2, volume_3, labels, volume_4, slice):
    fig, ax = plt.subplots(2, 3)
    ax[0,0].imshow((volume_0[slice]))
    ax[0,0].title.set_text('Predictions: Background')
    ax[1,0].imshow((volume_1[slice]))
    ax[1,0].title.set_text('Predictions: Membrane')
    ax[0,1].imshow((volume_2[slice]))
    ax[0,1].title.set_text('Predictions: Spikes')
    ax[1,1].imshow((volume_3[slice]))
    ax[1,1].title.set_text('Predictions: Inner')
    ax[0,2].imshow((labels[slice]))
    ax[0,2].title.set_text('Semi-Automatic Labels')
    ax[1,2].imshow((255.0 * volume_4[slice]), cmap='gray', vmin = 0, vmax = 255)
    ax[1,2].title.set_text('Input Data')
    plt.show()

# Block comparison
def display_block_slice_comparison(volume1, volume2, index, slice):
    pred_block = volume1[index[0], index[1], index[2]].cpu().float()
    label_block = volume2[index[0], index[1], index[2]].cpu().float()
    fig, ax = plt.subplots(1, 2)
    ax[0].imshow((pred_block[slice]))
    ax[0].title.set_text('Prediction')
    ax[1].imshow((label_block[slice]))
    ax[1].title.set_text('Label')
    plt.show()


# Save tensor to binary file in uint8 format
def save_to_binary_file(volume, filename):
    volume_uint8 = volume - volume.min()
    volume_uint8 = volume_uint8 / volume_uint8.max() * 255;
    volume_uint8 = volume_uint8.to(torch.uint8)
    volume_uint8 = volume_uint8.cpu().numpy();
    # buffer = io.BytesIO()
    # torch.save(volume_uint8, buffer)
    buffer = bytes(volume_uint8)
    with open(filename, 'w+b') as file:
        file.write(buffer)
        file.close()


# Save tensor to binary file in uint8 format
def save_to_binary_file_uint16(volume, filename):
    volume_uint16 = volume - volume.min()
    volume_uint16 = volume_uint16 / volume_uint16.max() * 65535;
    volume_uint16 = volume_uint16.to(torch.int32)
    volume_uint16 = volume_uint16.cpu().numpy();
    buffer = bytes(volume_uint16)
    with open(filename, 'w+b') as file:
        file.write(buffer)
        file.close()

# Save tensor to binary file in uint8 format
def save_to_binary_file_float(volume, filename):
    volume_float = volume
    volume_float = volume_float / volume_float.max()
    volume_float = volume_float.to(torch.float32)
    volume_float = volume_float.cpu().numpy()
    buffer = bytes(volume_float)
    with open(filename, 'w+b') as file:
        file.write(buffer)
        file.close()


# Returns cropped volume
def crop_volume_to_min_max(volume, min_locations, max_locations):
    return volume[min_locations[0]+1:max_locations[0], min_locations[1]+1:max_locations[1], min_locations[2]+1:max_locations[2]]
