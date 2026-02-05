import fs from "fs";
import YAML from "yaml";
import { createDocument } from "zod-openapi";
import { createErrorMap } from "zod-validation-error";
import zod from "zod";
import { userPath } from "@cocryovis/schemas/user-path-schema";
import { projectPath } from "@cocryovis/schemas/project-path-schema";
import { volumePath } from "@cocryovis/schemas/volume-path-schema";
import { volumeDataPath } from "@cocryovis/schemas/volume-data-path-schema";
import { modelsPath } from "@cocryovis/schemas/models-path-schema";
import { checkPointPath } from "@cocryovis/schemas/checkpoint-path-schema";
import { resultPath } from "@cocryovis/schemas/result-path-schema";
import { demoPath } from "@cocryovis/schemas/demo-path-schema";
import { IlastikPath } from "@cocryovis/schemas/Ilastik-path-schema";
import { nanoOetziPath } from "@cocryovis/schemas/nano-oetzi-path-schema";
import { cryoEtPath } from "@cocryovis/schemas/cryoEt-path-schema";

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
  { reused: "inline" }
);

export function writeOpenApi() {
  const yaml = YAML.stringify(document);
  fs.writeFileSync("openapi.yaml", yaml);
}
