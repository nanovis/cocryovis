import path from 'path';
import fileSystem from "fs";
import {promisify} from "node:util";
import {exec} from 'child_process';
const execPromise = promisify(exec);

class NanoOetziHandler {
    constructor(config) {
        this.config = config;
        this.inferenceRunning = false;
    }

    async runInference(inferenceDataPath, checkpointFilename, outputPath) {
        if (this.inferenceRunning) {
            throw new Error("Inference in progress.");
        }

        if (!fileSystem.existsSync(inferenceDataPath)) {
            throw new Error("Inference data does not exist");
        }
        if (!fileSystem.existsSync(checkpointFilename)) {
            throw new Error("Checkpoint file does not exist");
        }
        if (!fileSystem.existsSync(outputPath)) {
            fileSystem.mkdirSync(outputPath, {recursive: true});
        }

        const logPath = path.join(outputPath, '!inference.log');
        fileSystem.writeFileSync(logPath, 'Nano-Oetzi inference started\n--------------\n');

        this.inferenceRunning = true;
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

        try {
            const {stdout, stderr} = await execPromise(command, {cwd: path.resolve(this.config.scripts)});
            fileSystem.appendFileSync(logPath, `\nstdout: \n${stdout}`);
            fileSystem.appendFileSync(logPath, `\n\nstderr: \n${stderr}`);
            console.log('NanoOetzi inference finished');
            fileSystem.appendFileSync(logPath, `\n--------------\nNanoOetzi inference finished`);
        }
        catch (error) {
            fileSystem.appendFileSync(logPath, `\nERROR: \n${error}`);
            console.log(`NanoOetzi inference error: ${error}`);
            throw error;
        }
        finally {
            this.inferenceRunning = false;
        }
    }

    isInferenceRunning() {
        return this.inferenceRunning;
    }
}

export {NanoOetziHandler};