import {
  inferenceIds,
  trainingReq,
} from "@cocryovis/schemas/nano-oetzi-path-schema";
import validateSchema from "../tools/validate-schema.mjs";
import type GPUTaskHandler from "../tools/gpu-task-handler.ts";
import { type Request, type Response } from "express";

export default class NanoOetziController {
  static queueInference = async (
    gpuTaskHandler: GPUTaskHandler,
    req: Request,
    res: Response
  ) => {
    const { body } = validateSchema(req, { bodySchema: inferenceIds });

    const checkpointId = body.checkpointId;
    const volumeId = body.volumeId;

    await gpuTaskHandler.queueInference(
      checkpointId,
      volumeId,
      Number(req.session.user.id)
    );

    res.sendStatus(204);
  };

  static queueTraining = async (
    gpuTaskHandler: GPUTaskHandler,
    req: Request,
    res: Response
  ) => {
    const { body } = validateSchema(req, { bodySchema: trainingReq });

    await gpuTaskHandler.queueTraining(
      body.modelId,
      Number(req.session.user.id),
      body.trainingVolumes,
      body.validationVolumes,
      body.testingVolumes,
      body
    );

    res.sendStatus(204);
  };
}
