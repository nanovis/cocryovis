/* eslint-disable @typescript-eslint/consistent-type-imports */

type VolumeDB = import("@prisma/client").Volume;
type RawVolumeDataDB = import("@prisma/client").RawVolumeData;
type SparseLabelVolumeDataDB = import("@prisma/client").SparseLabelVolumeData;
type PseudoLabelVolumeDataDB = import("@prisma/client").PseudoLabelVolumeData;
type ResultDB = import("@prisma/client").Result;
type ResultVolumeDB = import("@prisma/client").ResultVolume;
type ResultDataFileDB = import("@prisma/client").ResultDataFile;
type CheckpointDB = import("@prisma/client").Checkpoint;
type RawVolumeDataFileDB = import("@prisma/client").RawVolumeDataFile;
type SparseVolumeDataFileDB = import("@prisma/client").SparseVolumeDataFile;
type PseudoVolumeDataFileDB = import("@prisma/client").PseudoVolumeDataFile;
type TaskHistoryDB = import("@prisma/client").TaskHistory;

type PhysicalUnitDB = import("@prisma/client").PhysicalUnit;
type PhysicalDimensions = Pick<VolumeDB, "physicalUnit" | "physicalSizeX" | "physicalSizeY" | "physicalSizeZ">;

type RawVolumeDataWithFileDB = RawVolumeDataDB & {dataFile: RawVolumeDataFileDB }
type SparseVolumeDataWithFileDB = SparseLabelVolumeDataDB & {dataFile: SparseVolumeDataFileDB }
type PseudoVolumeDataWithFileDB = PseudoLabelVolumeDataDB & {dataFile: PseudoVolumeDataFileDB }
type FullVolumeWithFileDB = VolumeDB & 
  {rawData: RawVolumeDataWithFileDB, sparseVolumes: SparseVolumeDataWithFileDB[], pseudoVolumes: PseudoVolumeDataWithFileDB[]};