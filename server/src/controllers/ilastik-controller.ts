import { idVolume } from "@cocryovis/schemas/componentSchemas/volume-schema";
import validateSchema from "../tools/validate-schema.mjs";
import { Request, Response } from "express";
import type IlastikHandler from "../tools/ilastik-handler";

export default class IlastikController {
  static async queuePseudoLabelsGeneration(
    ilastik: IlastikHandler,
    req: Request,
    res: Response
  ) {
    const { params } = validateSchema(req, { paramsSchema: idVolume });

    await ilastik.queueLabelGeneration(
      params.idVolume,
      Number(req.session.user.id)
    );

    res.sendStatus(201);
  }
}
