import {
  inferenceIds,
  trainingReq,
} from "@cocryovis/schemas/nano-oetzi-path-schema";
import validateSchema from "../tools/validate-schema.mjs";
import { type Request, type Response } from "express";
import type NanoOetziHandler from "../tools/nano-oetzi-handler.js";

export default class NanoOetziController {
  static queueInference = async (
    nanoOetziHandler: NanoOetziHandler,
    req: Request,
    res: Response
  ) => {
    const { body } = validateSchema(req, { bodySchema: inferenceIds });

    const checkpointId = body.checkpointId;
    const volumeId = body.volumeId;

    await nanoOetziHandler.queueInference(
      checkpointId,
      volumeId,
      Number(req.session.user.id)
    );

    res.sendStatus(204);
  };

  static queueTraining = async (
    nanoOetziHandler: NanoOetziHandler,
    req: Request,
    res: Response
  ) => {
    const { body } = validateSchema(req, { bodySchema: trainingReq });

    await nanoOetziHandler.queueTraining(
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
