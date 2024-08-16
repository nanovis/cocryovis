import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

class NanoOetziHandler {
    constructor(config) {
        this.config = config;
        this.inferenceRunning = false;
        this.output = '';
        this.finished = false;
    }

    runInference(inferenceDataPath, outputPath, checkpointFilename) {
        this.output = '';
        this.inferenceRunning = true;
        let inferenceDataAbsolutePath = path.resolve(inferenceDataPath);
        let outputAbsolutePath = path.resolve(outputPath);
        fs.mkdirSync(outputAbsolutePath, { recursive: true });

        let checkpointAbsolutePath = path.resolve(checkpointFilename);
        let params = [
            './' + this.config.inferenceCommand,
            inferenceDataAbsolutePath + ' ' + outputAbsolutePath + ' ',
            '-m ' + checkpointAbsolutePath
        ];
        let command = this.config.command + ' ' + params[0] + ' ' + params[1] + ' ' + params[2];
        console.log(command);

        exec(command, {cwd: path.resolve(this.config.scripts) }, (error, stdout, stderr) => {
            this.inferenceRunning = false;
            if (error) {
                this.output = `exec error: ${error}`;
            //   console.error(`exec error: ${error}`);
              return;
            }
            this.output += '\n\n';
            this.output += `stdout: \n${stdout}`;
            this.output += '\n\n';
            this.output += `stderr: \n${stderr}`;
            console.log(`stdout: ${stdout}`);
            // console.error(`stderr: ${stderr}`);
            this.finished = true;
            console.log('NanoOetzi inference finished');
          });
    }

    isInferenceRunning() {
        return this.inferenceRunning;
    }

    isFinished() {
        return this.finished;
    }

    getOutput() {
        return this.output;
    }
}

export {NanoOetziHandler};