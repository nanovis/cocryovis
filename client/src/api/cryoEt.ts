import type z from "zod";
import * as Utils from "../utils/helpers";
import type {
  tomogramSchema,
  tiltSeries,
} from "@cocryovis/schemas/cryoEt-path-schema";
import {
  maybeCompressFileToZip,
  type OptionalCompressionConfig,
} from "@/utils/compression";

export async function queueTiltSeriesReconstruction(
  request: z.infer<typeof tiltSeries>,
  compressionOptions?: OptionalCompressionConfig
) {
  const formData = new FormData();
  const fileToUpload = await maybeCompressFileToZip(
    request.tiltSeries,
    compressionOptions
  );
  formData.append("tiltSeries", fileToUpload);
  formData.append(
    "data",
    JSON.stringify({
      volumeId: request.data.volumeId,
      options: request.data.options,
    })
  );

  await Utils.sendApiRequest(`tilt-series-reconstruction`, {
    method: "POST",
    body: formData,
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
