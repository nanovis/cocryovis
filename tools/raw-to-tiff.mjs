// @ts-check

import sharp from "sharp";
import fs from "fs";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @param {RawVolumeDataDB[] | SparseLabelVolumeDataDB[]} volumeDataInstances
 * @param {String} outputFolder
 */
export async function rawToTiff(
    volumeDataInstances,
    outputFolder,
    resetLog = true
) {
    const inputInstances = [];
    for (const volumeDataInstance of volumeDataInstances) {
        if (volumeDataInstance.rawFilePath === null) {
            throw new Error(
                "Raw-To-Tiff Conversion: A setting file is missing an associated raw file."
            );
        }
        if (volumeDataInstance.settings === null) {
            throw new Error(
                "Raw-To-Tiff Conversion: A raw file is missing an associated setting file."
            );
        }
        const settings = JSON.parse(volumeDataInstance.settings);

        if (
            !Object.hasOwn(settings, "size") ||
            !Object.hasOwn(settings, "bytesPerVoxel")
        ) {
            throw new Error(
                "Raw-To-Tiff Conversion: Each volume requires a setting file with size and bytesPerVoxel properties."
            );
        }

        inputInstances.push({
            path: volumeDataInstance.rawFilePath,
            width: settings.size.x,
            height: settings.size.y,
            depth: settings.size.z,
            channels: settings.bytesPerVoxel,
        });
    }

    let channels = 0;
    const rawDataBuffers = [];
    const width = inputInstances[0].width;
    const height = inputInstances[0].height;
    const depth = inputInstances[0].depth;
    for (const inputInstance of inputInstances) {
        channels += inputInstance.channels;
        rawDataBuffers.push(fs.readFileSync(inputInstance.path));
        if (
            inputInstance.width !== width ||
            inputInstance.height !== height ||
            inputInstance.depth !== depth
        ) {
            throw new Error(
                `Raw-To-Tiff Conversion: All volumes must have the same dimensions.`
            );
        }
    }

    if (channels === 0) {
        throw new Error(`Raw-To-Tiff Conversion: No channels found.`);
    }

    if (channels > 4) {
        throw new Error(`Raw-To-Tiff Conversion: Too Many Channels.`);
    }

    const outputChannels = /** @type {1 | 2 | 3 | 4} */ (
        /** @type {unknown} */ channels
    );

    const sliceSize = width * height;

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    if (resetLog) {
        fs.writeFileSync(`${outputFolder}/conversion.log`, "");
    }
    fs.appendFileSync(
        `${outputFolder}/conversion.log`,
        `Parameters:\n-Dimensions: ${width}x${height}x${depth}\n-Channels: ${channels}\n\n`
    );

    const promises = [];

    for (let z = 0; z < depth; z++) {
        let multiChannelSliceBuffer = Buffer.alloc(sliceSize * channels);

        let offset = 0;
        for (
            let volumeIndex = 0;
            volumeIndex < inputInstances.length;
            volumeIndex++
        ) {
            const inputInstance = inputInstances[volumeIndex];
            let singleChannelBuffer = rawDataBuffers[volumeIndex].subarray(
                z * sliceSize * inputInstance.channels,
                (z + 1) * sliceSize * inputInstance.channels
            );

            for (let i = 0; i < width * height; i++) {
                singleChannelBuffer.copy(
                    multiChannelSliceBuffer,
                    i * channels + offset,
                    i * inputInstance.channels,
                    i * inputInstance.channels + inputInstance.channels
                );
            }
            offset += inputInstance.channels;
        }

        promises.push(
            sharp(multiChannelSliceBuffer, {
                raw: {
                    width: width,
                    height: height,
                    channels: outputChannels,
                },
            })
                .toColourspace("b-w")
                .tiff({
                    quality: 100,
                    compression: "none",
                })
                .toFile(`${outputFolder}/slice_${z}.tiff`)
                .then((info) => {
                    fs.appendFileSync(
                        `${outputFolder}/conversion.log`,
                        `Slice ${z} created: ${JSON.stringify(info, null, 1)}\n`
                    );
                })
                .catch((err) => {
                    fs.appendFileSync(
                        `${outputFolder}/log.log`,
                        `Error processing slice ${z}: ${err}\n`
                    );
                    throw err;
                })
        );
    }
    await Promise.all(promises);
}
