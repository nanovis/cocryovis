import type z from "zod";
import * as Utils from "../utils/helpers";
import type { tomogramSchema } from "@cocryovis/schemas/cryoEt-path-schema";

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
  const tomogram = (await response.json()) as z.infer<typeof tomogramSchema>;
  return tomogram;
}
