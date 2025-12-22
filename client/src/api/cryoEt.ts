import type z from "zod";
import * as Utils from "../utils/Helpers";
import type { tomogramSchema } from "#schemas/cryoEt-path-schema.mjs";

export async function queueTiltSeriesReconstruction(request: FormData) {
  await Utils.sendApiRequest(`tilt-series-reconstruction`, {
    method: "POST",
    body: request,
  });
}

export async function getTomographyMetadataFromCryoETId(id: number) {
  const response = await Utils.sendApiRequest(`cryoet/${id.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  const tomogram: z.infer<typeof tomogramSchema> = await response.json();
  return tomogram;
}
