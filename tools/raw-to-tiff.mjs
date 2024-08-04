import sharp from "sharp";
import fs from "fs";

export async function rawToTiff(inputFile, outputFolder, width, height, depth, channels, resetLog = true) {
    const sliceSize = width * height * channels;

    const rawData = fs.readFileSync(inputFile);

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
    }

    if (resetLog) {
        fs.writeFileSync(`${outputFolder}/conversion.log`, '');
    }
    fs.appendFileSync(`${outputFolder}/conversion.log`,
        `Converting ${inputFile}\nParameters:\n-Dimensions: ${width}x${height}x${depth}\n-Channels: ${channels}\n\n`);

    const promises = [];

    for (let z = 0; z < depth; z++) {
        const sliceStart = z * sliceSize;
        const sliceEnd = sliceStart + sliceSize;

        const sliceBuffer = rawData.subarray(sliceStart, sliceEnd);

        promises.push(sharp(sliceBuffer, {
            raw: {
                width: width,
                height: height,
                channels: channels
            }
        })
            .toColourspace('b-w')
            .tiff({
                quality: 100,
                compression: 'none',
            })
            .toFile(`${outputFolder}/slice_${z}.tiff`)
            .then(info => {
                console.log(z)
                fs.appendFileSync(`${outputFolder}/conversion.log`,
                    `Slice ${z} created: ${JSON.stringify(info, null, 1)}\n`);
            })
            .catch(err => {
                fs.appendFileSync(`${outputFolder}/log.log`, `Error processing slice ${z}: ${err}\n`);
                throw err;
            }));
    }
    await Promise.all(promises);
}


// rawToTiff('../data/volumes/1_123/raw-data/ts_16_bin4-256x256.raw', 'tiff_files', 256, 256, 448, 1);