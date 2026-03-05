/* eslint-disable @typescript-eslint/consistent-type-imports */

declare type VolumeDB = import("@prisma/client").Volume;
declare type RawVolumeDataDB = import("@prisma/client").RawVolumeData;
declare type SparseLabelVolumeDataDB = import("@prisma/client").SparseLabelVolumeData;
declare type PseudoLabelVolumeDataDB = import("@prisma/client").PseudoLabelVolumeData;
declare type ResultDB = import("@prisma/client").Result;
declare type ResultVolumeDB = import("@prisma/client").ResultVolume;
declare type ResultDataFileDB = import("@prisma/client").ResultDataFile;
declare type CheckpointDB = import("@prisma/client").Checkpoint;
declare type RawVolumeDataFileDB = import("@prisma/client").RawVolumeDataFile;
declare type SparseVolumeDataFileDB = import("@prisma/client").SparseVolumeDataFile;
declare type PseudoVolumeDataFileDB = import("@prisma/client").PseudoVolumeDataFile;
declare type TaskHistoryDB = import("@prisma/client").TaskHistory;

declare type RawVolumeDataWithFileDB = RawVolumeDataDB & {dataFile: RawVolumeDataFileDB }
declare type SparseVolumeDataWithFileDB = SparseLabelVolumeDataDB & {dataFile: SparseVolumeDataFileDB }
declare type PseudoVolumeDataWithFileDB = PseudoLabelVolumeDataDB & {dataFile: PseudoVolumeDataFileDB }
declare type FullVolumeWithFileDB = VolumeDB & 
  {rawData: RawVolumeDataWithFileDB, sparseVolumes: SparseVolumeDataWithFileDB[], pseudoVolumes: PseudoVolumeDataWithFileDB[]};