import type z from "zod";
import * as Utils from "../utils/helpers";
import type {
  inferenceIds,
  trainingReq,
} from "@cocryovis/schemas/nano-oetzi-path-schema";

export async function queueInference(request: z.input<typeof inferenceIds>) {
  await Utils.sendApiRequest(`queue-inference`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export async function queueTraining(request: z.input<typeof trainingReq>) {
  await Utils.sendApiRequest(`queue-training`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}
