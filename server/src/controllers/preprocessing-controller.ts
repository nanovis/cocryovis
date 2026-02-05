// @ts-check

import type { tiltSeriesOptions } from "@cocryovis/schemas/cryoEt-path-schema";
import { ApiError } from "../tools/error-handler.mjs";
import type GPUTaskHandler from "../tools/gpu-task-handler";
import { type Request, type Response } from "express";
import type z from "zod";

export default class PreProcessingController {
  static async queueTiltSeriesReconstruction(
    gpuTaskHandler: GPUTaskHandler,
    req: Request,
    res: Response
  ) {
    // TODO make validateSchema work with multipart/form-data
    // const { body } = validateSchema(req, {
    //     bodySchema: tiltSeriesValidation,
    // });

    if (!req.files?.tiltSeries) {
      throw new ApiError(400, "No files uploaded.");
    }

    if (Array.isArray(req.files.tiltSeries)) {
      throw new ApiError(400, "Only one tilt series can be added to volume.");
    }

    if (!req.body) {
      throw new ApiError(400, "No data provided.");
    }
    const body = req.body as { data: string };

    // Check if zod parses json
    const data = JSON.parse(body.data) as {
      options: z.infer<typeof tiltSeriesOptions>;
      volumeId: number;
    };

    await gpuTaskHandler.queueTiltSeriesReconstruction(
      req.files.tiltSeries,
      data.options,
      data.volumeId,
      req.session.user.id
    );

    res.sendStatus(204);
  }
}
