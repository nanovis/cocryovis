import * as Utils from "../utils/Helpers";

export async function queuePseudoLabelsGeneration(id: number) {
  await Utils.sendApiRequest(`volume/${id}/queue-pseudo-label-generation`, {
    method: "POST",
    credentials: "include",
  });
}
