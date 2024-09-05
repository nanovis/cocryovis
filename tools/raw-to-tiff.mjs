// @ts-check

import sharp from "sharp";
import fs from "fs";
import fsPromises from "fs/promises";

/**
 * @typedef { import("@prisma/client").RawVolumeData } RawVolumeDataDB
 * @typedef { import("@prisma/client").SparseLabelVolumeData } SparseLabelVolumeDataDB
 */

/**
 * @param {String} inputFile
 * @param {{size: {x: number, y: number, z:number}, bytesPerVoxel: 1 | 2 | 3 | 4}} settings
 * @param {String} outputFolder
 */
export async function rawToTiffSingleFile(
    inputFile,
    settings,
    outputFolder,
    resetLog = true
) {
    if (
        !Object.hasOwn(settings, "size") ||
        !Object.hasOwn(settings, "bytesPerVoxel")
    ) {
        throw new Error(
            "Raw-To-Tiff Conversion: Volume requires a setting file with size and bytesPerVoxel properties."
        );
    }

    if (settings.bytesPerVoxel < 1 || settings.bytesPerVoxel > 4) {
        throw new Error(
            "Raw-To-Tiff Conversion: Input volume must have between 1 and 4 bytes per pixel."
        );
    }

    const width = settings.size.x;
    const height = settings.size.y;
    const depth = settings.size.z;
    const channels = settings.bytesPerVoxel;

    const sliceSize = width * height * channels;

    const rawData = await fsPromises.readFile(inputFile);

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    if (resetLog) {
        await fsPromises.writeFile(`${outputFolder}/conversion.log`, "");
    }
    await fsPromises.appendFile(
        `${outputFolder}/conversion.log`,
        `Converting ${inputFile}\nParameters:\n-Dimensions: ${width}x${height}x${depth}\n-Channels: ${channels}\n\n`
    );

    const promises = [];

    for (let z = 0; z < depth; z++) {
        const sliceStart = z * sliceSize;
        const sliceEnd = sliceStart + sliceSize;

        const sliceBuffer = rawData.subarray(sliceStart, sliceEnd);

        promises.push(
            sharp(sliceBuffer, {
                raw: {
                    width: width,
                    height: height,
                    channels: channels,
                },
            })
                .toColourspace("b-w")
                .tiff({
                    quality: 100,
                    compression: "none",
                })
                .toFile(`${outputFolder}/slice_${z}.tiff`)
                .then((info) => {
                    console.log(z);
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

/**
 * @param {SparseLabelVolumeDataDB[]} labels
 * @param {String} outputFolder
 */
export async function rawToTiffLabels(labels, outputFolder, resetLog = true) {
    const inputInstances = [];
    for (const volumeDataInstance of labels) {
        if (volumeDataInstance.rawFilePath === null) {
            throw new Error(
                "Raw-To-Tiff Conversion: Volume is missing a raw file."
            );
        }
        if (volumeDataInstance.settings === null) {
            throw new Error(
                "Raw-To-Tiff Conversion: Volume is missing a setting file."
            );
        }
        /**
         * @type {{size: {x: number, y: number, z:number}, bytesPerVoxel: 1 | 2 | 3 | 4}}
         */
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

    const rawDataBuffers = [];
    const width = inputInstances[0].width;
    const height = inputInstances[0].height;
    const depth = inputInstances[0].depth;
    const channels = inputInstances[0].channels;
    if (channels < 1 || channels > 4) {
        throw new Error(
            "Raw-To-Tiff Conversion: Input volumes must have between 1 and 4 bytes per pixel."
        );
    }
    for (const inputInstance of inputInstances) {
        rawDataBuffers.push(await fsPromises.readFile(inputInstance.path));
        if (
            inputInstance.width !== width ||
            inputInstance.height !== height ||
            inputInstance.depth !== depth
        ) {
            throw new Error(
                `Raw-To-Tiff Conversion: All volumes must have the same dimensions.`
            );
        }
        if (inputInstance.channels !== channels) {
            throw new Error(
                `Raw-To-Tiff Conversion: All volumes must have the same number of bytes per voxel.`
            );
        }
    }

    const sliceSize = width * height * channels;

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    if (resetLog) {
        await fsPromises.writeFile(`${outputFolder}/conversion.log`, "");
    }
    await fsPromises.appendFile(
        `${outputFolder}/conversion.log`,
        `Parameters:\n-Dimensions: ${width}x${height}x${depth}\n-Channels: ${channels}\n\n`
    );

    const promises = [];

    for (let z = 0; z < depth; z++) {
        const sliceStart = z * sliceSize;

        const sliceBuffer = Buffer.alloc(width * height);
        for (let i = 0; i < sliceSize; i++) {
            var max = -1;
            var maxIndex = 0;
            for (let labelIndex = 0; labelIndex < inputInstances.length; labelIndex++) {
                const val = rawDataBuffers[i][sliceStart + i];
                if (val > max) {
                    maxIndex = labelIndex;
                    max = val;
                }
            }
            sliceBuffer[sliceStart + i] = maxIndex;
        }

        // const sliceBuffer = rawData.subarray(sliceStart, sliceEnd);

        promises.push(
            sharp(sliceBuffer, {
                raw: {
                    width: width,
                    height: height,
                    channels: 1,
                },
            })
                .toColourspace("b-w")
                .tiff({
                    quality: 100,
                    compression: "none",
                })
                .toFile(`${outputFolder}/slice_${z}.tiff`)
                .then((info) => {
                    console.log(z);
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

/**
 * @param {RawVolumeDataDB[] | SparseLabelVolumeDataDB[]} volumeDataInstances
 * @param {String} outputFolder
 */
export async function rawToTiffMultiFileMultiChannel(
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
