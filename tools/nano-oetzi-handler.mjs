// @ts-check

import path from 'path';
import fileSystem from "fs";
import {promisify} from "node:util";
import {exec} from 'child_process';
const execPromise = promisify(exec);
import {TaskQueue} from './task-queue.mjs';
import {getInverseDateString} from "./utils.mjs";
import {rm, appendFile} from "node:fs/promises";

export class NanoOetziHandler {
    constructor(config) {
        this.config = config;
        this.taskQueue = new TaskQueue();
    }

    isInferenceRunning() {
        return this.taskQueue.hasPendingTask;
    }

    #createTemporaryOutputPath() {
        if (this.taskQueue.size >= this.config.maxQueueSize) {
            throw new Error("Failed Attempt to start inference: Too many tasks in queue.")
        }
        let tempFolderPath = path.join(this.config.workCache, getInverseDateString());
        while(fileSystem.existsSync(tempFolderPath)) {
            tempFolderPath += "_";
        }
        fileSystem.mkdirSync(tempFolderPath, {recursive: true});
        return tempFolderPath;
    }

    /**
     * @param {String} inferenceDataPath
     * @param {String} checkpointFilename
     * @param {String?} outputPath
     * @returns {Promise<String>}
     */
    queueInference(inferenceDataPath, checkpointFilename, outputPath = null) {
        if (!inferenceDataPath) {
            throw new Error("Failed Attempt to start inference: Missing inference data path.")
        }
        if (!checkpointFilename) {
            throw new Error("Failed Attempt to start inference: Missing checkpoint data path.")
        }

        if (!outputPath) {
            outputPath = this.#createTemporaryOutputPath();
        }
        return this.taskQueue.enqueue(
            () => this.#runInference(inferenceDataPath, checkpointFilename, outputPath));
    }

    /**
     * @param {String} inferenceDataPath
     * @param {String} checkpointFilename
     * @param {String} outputPath
     * @returns {Promise<String>}
     */
    async #runInference(inferenceDataPath, checkpointFilename, outputPath) {
        const logPath = path.join(outputPath, '!inference.log');

        try {
            if (!fileSystem.existsSync(inferenceDataPath)) {
                throw new Error("Failed Attempt to start inference: Inference data does not exist");
            }
            if (!fileSystem.existsSync(checkpointFilename)) {
                throw new Error("Failed Attempt to start inference: Checkpoint file does not exist");
            }
            if (!fileSystem.existsSync(outputPath)) {
                fileSystem.mkdirSync(outputPath, {recursive: true});
            }

            fileSystem.writeFileSync(logPath, 'Nano-Oetzi inference started\n--------------\n');

            let inferenceDataAbsolutePath = path.resolve(inferenceDataPath);
            let outputAbsolutePath = path.resolve(outputPath);

            if (!fileSystem.existsSync(outputAbsolutePath)) {
                fileSystem.mkdirSync(outputAbsolutePath, {recursive: true});
            }

            let checkpointAbsolutePath = path.resolve(checkpointFilename);
            let params = [
                './' + this.config.inferenceCommand,
                inferenceDataAbsolutePath + ' ' + outputAbsolutePath + ' ',
                '-m ' + checkpointAbsolutePath
            ];
            let command = this.config.command + ' ' + params[0] + ' ' + params[1] + ' ' + params[2];
            console.log(command);

            const {stdout, stderr} = await execPromise(command, {cwd: path.resolve(this.config.scripts)});
            await appendFile(logPath,
                `\nstdout: \n${stdout}\n\nstderr: \n${stderr}\n--------------\nNanoOetzi inference finished`);
            console.log('NanoOetzi inference finished');
            return outputPath;
        }
        catch (error) {
            await appendFile(logPath, `\nERROR: \n${error}`);
            console.log(`NanoOetzi inference error: ${error}`);
            await rm(outputPath, {recursive: true, force: true});
            throw error;
        }
    }
}