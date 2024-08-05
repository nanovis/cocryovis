import { exec, spawnSync } from 'child_process';
import  * as fileSystem from 'fs';
import { resolve } from 'path';

class IlastikHandler {
    constructor(config) {
        this.config = config;
        this.inferenceRunning = false;
        this.output = '';
        this.finished = false;
    }

    getVersion() {
        let result = spawnSync(this.config.path + this.config.command, ['--version']);
        return result.stdout.toString().split('\n')[0];
    }

    getIlastikPath() {
        return this.config.path;
    }

    getIlastikDataPath() {
        return this.config.data;
    }
/*
./python ./train_headless.py /home/bohakc/crop/ts_16_crop_test_project.ilp "/home/bohakc/crop/input/*.tif" "/home/bohakc/crop/labels/*.tiff"

./run_ilastik.sh --headless --project=/home/bohakc/crop/ts_16_crop_test_project.ilp --output_format="tif sequence" --export_source="Probabilities" --export_dtype=uint8 --pipeline_result_drange="(0.0,1.0)" --export_drange="(0,255)" --output_filename_format=/home/bohakc/crop/ts_16_crop_output/{nickname}_{slice_index}_results.tiff "/home/bohakc/crop/input/*.tif"

../ilastik/run_ilastik.sh --headless --project=/home/bohakc/volWeb/models/2-Ilastik_test/model_project.ilp --output_format="tif sequence" --export_source="Probabilities" --export_dtype=uint8 --pipeline_result_drange="(0.0,1.0)" --export_drange="(0,255)" --output_filename_format=/home/bohakc/volWeb/models/2-Ilastik_test/ilastik-labels/tif/{nickname}_{slice_index}_results.tif /home/bohakc/volWeb/models/2-Ilastik_test/raw-data/tif/*.tif
*/
    runIlastikInference(modelPath, rawDataId, sparseLabelsId, model, db) {
        console.log('Running Ilastik inference');
        this.isInferenceRunning = true;
        this.output = '\n\nIlastik inference started\n\n';
        this.inferenceRunning = true;
        
        let ilastikLabels = {};
        ilastikLabels.id = model.ilastikLabels.length + 1;
        ilastikLabels.idRawData = rawDataId;

        const modelFullPath = resolve(modelPath);
        let params = [
            '--headless',
            '--project=' + modelFullPath + '/model_project.ilp',
            '--output_format="tif sequence"',
            '--export_source="Probabilities"',
            '--export_dtype=uint8',
            '--pipeline_result_drange="(0.0,1.0)"',
            '--export_drange="(0,255)"',
            '--output_filename_format=' + modelFullPath + '/ilastik-labels/' + ilastikLabels.id + '/{nickname}_{slice_index}_results.tif',
            '"' + modelFullPath + '/raw-data/' + rawDataId + '/*.tif"'
        ];
        let command = this.config.path + this.config.inference + ' ' + params.join(' ');
        console.log(command);
        
        fileSystem.mkdirSync(modelFullPath + '/ilastik-labels/' + sparseLabelsId, { recursive: true });

        exec(command, (error, stdout, stderr) => {
            this.inferenceRunning = false;
            if (error) {
                this.output = `exec error: ${error}`;
              return;
            }
            this.output += '\n\n';
            this.output += `stdout: \n${stdout}`;
            this.output += '\n\n';
            this.output += `stderr: \n${stderr}`;
            this.inferenceRunning = false;
            this.finished = true;
            console.log('Ilastik inference finished');
            

            ilastikLabels.idSparseLabels = sparseLabelsId;
            model.ilastikLabels.push(ilastikLabels);
            db.write();
            console.log("Ilastik labels successfully generated.");
        });
    }

    createIlastikProject(modelPath, rawDataId, sparseLabelsId, model, db) {
        console.log('Creating Ilastik project');
        this.output = '\n\nCreating Ilastik project\n\n';
        this.finished = false;
        const modelFullPath = resolve(modelPath);
        let params = [
            this.config.scripts_path + this.config.create_project_command,
            modelFullPath + '/' + 'model_project.ilp',
            '"' + modelFullPath + '/raw-data/' + rawDataId + '/*.tif"',
            '"' + modelFullPath + '/sparse-labels/' + sparseLabelsId + '/*.tif"'
        ];
        let command = this.config.python + ' ' + params.join(' ');
        console.log(command);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                this.output = `exec error: ${error}`;
              return;
            }
            this.output += '\n\n';
            this.output += `stdout: \n${stdout}`;
            this.output += '\n\n';
            this.output += `stderr: \n${stderr}`;
            console.log('Ilastik project created');

            // Run Ilastik inference
            this.runIlastikInference(modelPath, rawDataId, sparseLabelsId, model, db);
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

    generateLabels(modelPath, rawDataId, sparseLabelsId, model, db) {
        // Create Ilastik project and inference
        this.createIlastikProject(modelPath, rawDataId, sparseLabelsId, model, db);
    }
}

export {IlastikHandler};