import * as Utils from "../utils/Helpers";

export async function queuePseudoLabelsGeneration(id: number) {
  await Utils.sendRequestWithToast(
    `volume/${id}/queue-pseudo-label-generation`,
    {
      method: "POST",
      credentials: "include",
    },
    { successText: "Label generation successfuly queued!" }
  );
}
