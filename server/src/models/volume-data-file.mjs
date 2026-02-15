// @ts-check

import DatabaseModel from "./database-model.mjs";
/**
 * @typedef { import("@prisma/client").PseudoVolumeDataFile }PseudoVolumeDataFileDB
 */

export default class VolumeDataFile extends DatabaseModel {
  static volumeDataFolder = "volume-data";
}
