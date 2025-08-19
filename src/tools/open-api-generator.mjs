// @ts-check
import fs from "fs";
import YAML from "yaml";
import { createDocument } from "zod-openapi";
import { createErrorMap } from "zod-validation-error";
import zod from "zod";
import { userPath } from "#schemas/user-path-schema.mjs";
import { projectPath } from "#schemas/project-path-schema.mjs";
import { volumePath } from "#schemas/volume-path-schema.mjs";
import { volumeDataPath } from "#schemas/volume-data-path-schema.mjs";
import { modelsPath } from "#schemas/models-path-schema.mjs";
import { checkPointPath } from "#schemas/checkpoint-path-schema.mjs";
import { resultPath } from "#schemas/result-path-schema.mjs";
import { demoPath } from "#schemas/demo-path-schema.mjs";
import { IlastikPath } from "#schemas/Ilastik-path-schema.mjs";
import { nanoOetziPath } from "#schemas/nano-oetzi-path-schema.mjs";
import { cryoEtPath } from "#schemas/cryoEt-path-schema.mjs";


// Makes errors readable
zod.config({
    customError: createErrorMap(),
});

const document = createDocument(
    {
        openapi: "3.1.0",
        info: {
            title: "My API",
            version: "1.0.0",
        },
        servers: [
            {
                url: "http://localhost:8080/api",
            },
        ],
        paths: {
            ...userPath,
            ...projectPath,
            ...volumePath,
            ...volumeDataPath,
            ...modelsPath,
            ...checkPointPath,
            ...resultPath,
            ...demoPath,
            ...IlastikPath,
            ...nanoOetziPath,
            ...cryoEtPath,
        },
    },
    { reused: "ref" }
);
export function writeOpenApi() {
    const yaml = YAML.stringify(document);
    fs.writeFileSync("openapi.yaml", yaml);
}
