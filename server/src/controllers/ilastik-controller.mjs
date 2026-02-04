// @ts-check

import { idVolume } from "@cocryovis/schemas/componentSchemas/volume-schema";
import validateSchema from "../tools/validate-schema.mjs";

/**
 * @import Ilastik from "../tools/ilastik-handler.mjs"
 * @typedef { import("express").Request } Request
 * @typedef { import("express").Response } Response
 */
export default class IlastikController {
  /**
   * @param {Ilastik} ilastik
   * @param {Request} req
   * @param {Response} res
   */
  static async queuePseudoLabelsGeneration(ilastik, req, res) {
    const { params } = validateSchema(req, { paramsSchema: idVolume });

    await ilastik.queueLabelGeneration(
      params.idVolume,
      Number(req.session.user.id)
    );

    res.sendStatus(201);
  }
}
