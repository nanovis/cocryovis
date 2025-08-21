import * as Utils from "../utils/Helpers";

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
