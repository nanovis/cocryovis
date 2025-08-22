import z from "zod";
import * as Utils from "../utils/Helpers";
import { tomogramSchema } from "#schemas/cryoEt-path-schema.mjs";

export async function queueTiltSeriesReconstruction(request: FormData) {
  await Utils.sendReq(
    `tilt-series-reconstruction`,
    {
      method: "POST",
      body: request,
    },
    false
  );
}

export async function getTomographyMetadataFromCryoETId(id: number) {
  const response = await Utils.sendReq(
    `cryoet/${id}`,
    {
      method: "GET",
      credentials: "include",
    },
    false
  );
  const tomogram: z.infer<typeof tomogramSchema> =
    await response.json();
  return tomogram;
}
