import type { Instance, SnapshotIn } from "mobx-state-tree";
import { types } from "mobx-state-tree";
import * as Utils from "../../utils/helpers";
import {
  BooleanInputField,
  NumberInputField,
  StringInputFieldType,
} from "@/utils/input";

export const TiltSeriesDialog = types
  .model({
    pendingFile: types.frozen<File | null>(null),
    optionsTab: types.optional(types.number, 3),
    serverSide: types.optional(types.boolean, false),
    showAdvancedOptions: types.optional(types.boolean, false),
    volume_depth: types.optional(types.string, ""),
    alignmentEnabled: types.optional(types.boolean, false),
    ctfEnabled: types.optional(types.boolean, false),
    motionCorrectionEnabled: types.optional(types.boolean, false),
    reconstruction: types.optional(
      types.model({
        tiled: types.optional(types.boolean, true),
        crop: types.optional(types.boolean, true),
        is_data_linearized: types.optional(types.boolean, false),
        delinearize_result: types.optional(types.boolean, false),
        data_term_end: types.optional(types.boolean, false),
        data_term_iters: types.optional(types.string, ""),
        proximal_iters: types.optional(types.string, ""),
        sample_rate: types.optional(types.string, ""),
        chill_factor: types.optional(types.string, ""),
        lambda: types.optional(types.string, ""),
        number_extra_rows: types.optional(types.string, ""),
        starting_angle: types.optional(types.string, ""),
        angle_step: types.optional(types.string, ""),
        nlm_skip: types.optional(types.string, ""),
      }),
      {}
    ),
    alignment: types.optional(
      types.model({
        peak: types.optional(types.string, ""),
        diff: types.optional(types.string, ""),
        grow: types.optional(types.string, ""),
        iterations: types.optional(types.string, ""),
        numOfPatches: types.optional(types.string, ""),
        patchSize: types.optional(types.string, ""),
        patchRadius: types.optional(types.string, ""),
        rotationAngle: types.optional(types.string, ""),
      }),
      {}
    ),
    ctf: types.optional(
      types.model({
        highTension: types.optional(types.string, ""),
        sphericalAberration: types.optional(types.string, ""),
        amplitudeContrast: types.optional(types.string, ""),
        pixelSize: types.optional(types.string, ""),
        tileSize: types.optional(types.string, ""),
      }),
      {}
    ),
    motionCorrection: types.optional(
      types.model({
        patchSize: types.optional(types.string, ""),
        iterations: types.optional(types.string, ""),
        tolerance: types.optional(types.string, ""),
        pixelSize: types.optional(types.string, ""),
        fmDose: types.optional(types.string, ""),
        highTension: types.optional(types.string, ""),
      }),
      {}
    ),
  })
  .actions((self) => ({
    setPendingFile: (file: File | null) => {
      self.pendingFile = file;
    },
    setOptionsTab: (tab: number) => {
      self.optionsTab = tab;
    },
    setServerSide: (serverSide: boolean) => {
      self.serverSide = serverSide;
    },
    setShowAdvancedOptions: (show: boolean) => {
      self.showAdvancedOptions = show;
    },
    setAlignmentEnabled: (enabled: boolean) => {
      self.alignmentEnabled = enabled;
    },
    setCtfEnabled: (enabled: boolean) => {
      self.ctfEnabled = enabled;
    },
    setMotionCorrectionEnabled: (enabled: boolean) => {
      self.motionCorrectionEnabled = enabled;
    },
    setVolumeDepth: (value: string) => {
      self.volume_depth = value;
    },
    setDataTermIters: (value: string) => {
      self.reconstruction.data_term_iters = value;
    },
    setProximalIters: (value: string) => {
      self.reconstruction.proximal_iters = value;
    },
    setSampleRate: (value: string) => {
      self.reconstruction.sample_rate = value;
    },
    setChillFactor: (value: string) => {
      self.reconstruction.chill_factor = value;
    },
    setLambda: (value: string) => {
      self.reconstruction.lambda = value;
    },
    setNumberExtraRows: (value: string) => {
      self.reconstruction.number_extra_rows = value;
    },
    setStartingAngle: (value: string) => {
      self.reconstruction.starting_angle = value;
    },
    setAngleStep: (value: string) => {
      self.reconstruction.angle_step = value;
    },
    setNlmSkip: (value: string) => {
      self.reconstruction.nlm_skip = value;
    },
    setTiled: (value: boolean) => {
      self.reconstruction.tiled = value;
    },
    setCrop: (value: boolean) => {
      self.reconstruction.crop = value;
    },
    setIsDataLinearized: (value: boolean) => {
      self.reconstruction.is_data_linearized = value;
    },
    setDelinearizeResult: (value: boolean) => {
      self.reconstruction.delinearize_result = value;
    },
    setDataTermEnd: (value: boolean) => {
      self.reconstruction.data_term_end = value;
    },
    // Alignment
    setPeak: (value: string) => {
      self.alignment.peak = value;
    },
    setDiff: (value: string) => {
      self.alignment.diff = value;
    },
    setGrow: (value: string) => {
      self.alignment.grow = value;
    },
    setIterationsAlignment: (value: string) => {
      self.alignment.iterations = value;
    },
    setNumOfPatches: (value: string) => {
      self.alignment.numOfPatches = value;
    },
    setPatchSizeAlignment: (value: string) => {
      self.alignment.patchSize = value;
    },
    setPatchRadius: (value: string) => {
      self.alignment.patchRadius = value;
    },
    setRotationAngle: (value: string) => {
      self.alignment.rotationAngle = value;
    },
    // CTF
    setHighTensionCTF: (value: string) => {
      self.ctf.highTension = value;
    },
    setSphericalAberration: (value: string) => {
      self.ctf.sphericalAberration = value;
    },
    setAmplitudeContrast: (value: string) => {
      self.ctf.amplitudeContrast = value;
    },
    setPixelSizeCTF: (value: string) => {
      self.ctf.pixelSize = value;
    },
    setTileSize: (value: string) => {
      self.ctf.tileSize = value;
    },
    // Motion Correction
    setPatchSizeMotion: (value: string) => {
      self.motionCorrection.patchSize = value;
    },
    setIterationsMotion: (value: string) => {
      self.motionCorrection.iterations = value;
    },
    setTolerance: (value: string) => {
      self.motionCorrection.tolerance = value;
    },
    setPixelSizeMotion: (value: string) => {
      self.motionCorrection.pixelSize = value;
    },
    setFmDose: (value: string) => {
      self.motionCorrection.fmDose = value;
    },
    setHighTensionMotion: (value: string) => {
      self.motionCorrection.highTension = value;
    },
  }))
  .volatile((self) => ({
    isBusy: false,
    generalInputs: {
      volume_depth: new NumberInputField(
        "Volume Depth",
        () => {
          return self.volume_depth;
        },
        self.setVolumeDepth,
        StringInputFieldType.INTEGER,
        "Volume Depth must be a positive integer.",
        null,
        null,
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
    },
    reconstructionInputs: {
      tiled: new BooleanInputField(
        "Tiled",
        () => {
          return self.reconstruction.tiled;
        },
        self.setTiled,
        true,
        "Whether the computation is done by tiles."
      ),
      crop: new BooleanInputField(
        "Crop",
        () => {
          return self.reconstruction.crop;
        },
        self.setCrop,
        true,
        "Whether the results are cropped before saving."
      ),
      is_data_linearized: new BooleanInputField(
        "Linearized Data",
        () => {
          return self.reconstruction.is_data_linearized;
        },
        self.setIsDataLinearized,
        false,
        "Whether the tilt series has been linearized previously."
      ),
      delinearize_result: new BooleanInputField(
        "Delinerize Result",
        () => {
          return self.reconstruction.delinearize_result;
        },
        self.setDelinearizeResult,
        true,
        "Whether the results are delinearized before saving."
      ),
      data_term_end: new BooleanInputField(
        "Run Final Data Term Operation",
        () => {
          return self.reconstruction.data_term_end;
        },
        self.setDataTermEnd,
        false,
        "Whether a final data term operation is run at the end of reconstruction."
      ),
      data_term_iters: new NumberInputField(
        "Inner Iterations",
        () => {
          return self.reconstruction.data_term_iters;
        },
        self.setDataTermIters,
        StringInputFieldType.INTEGER,
        "Inner Iterations must be an integer between 1 and 20.",
        2,
        "Number of data term (inner) iterations on each proximal algorithm iteration.",
        (value: number) => Utils.isIntegerBetween(value, 1, 20)
      ),
      proximal_iters: new NumberInputField(
        "Outer Iterations",
        () => {
          return self.reconstruction.proximal_iters;
        },
        self.setProximalIters,
        StringInputFieldType.INTEGER,
        "Outer Iterations must be an integer between 1 and 200.",
        80,
        "Number of (outer) iterations of proximal algorithm.",
        (value: number) => Utils.isIntegerBetween(value, 1, 200)
      ),
      sample_rate: new NumberInputField(
        "Sample Rate",
        () => {
          return self.reconstruction.sample_rate;
        },
        self.setSampleRate,
        StringInputFieldType.FLOAT,
        "Sample Rate must be between 0.25 and 1.",
        0.5,
        "Distance between samples in forward projection.",
        (value: number) => Utils.isFloatBetween(value, 0.25, 1)
      ),
      chill_factor: new NumberInputField(
        "Chill Factor",
        () => {
          return self.reconstruction.chill_factor;
        },
        self.setChillFactor,
        StringInputFieldType.FLOAT,
        "Chill Factor must be between 0.001 and 1.",
        0.2,
        "Relaxation parameter for backprojection.",
        (value: number) => Utils.isFloatBetween(value, 0.001, 1)
      ),
      lambda: new NumberInputField(
        "Lambda",
        () => {
          return self.reconstruction.lambda;
        },
        self.setLambda,
        StringInputFieldType.FLOAT,
        "Lambda must be between 0.1 and 2000.",
        1000,
        "Regularization parameter of data term proximal operator.",
        (value: number) => Utils.isFloatBetween(value, 0.1, 2000)
      ),
      number_extra_rows: new NumberInputField(
        "Extra Rows",
        () => {
          return self.reconstruction.number_extra_rows;
        },
        self.setNumberExtraRows,
        StringInputFieldType.INTEGER,
        "Extra rows must be an even integer above 60.",
        80,
        "Number of extra rows above and below each tile to prevent line artifacts. If for some reason line artifacts ocurr between the tiles, increase this value.",
        (value: number) =>
          Utils.isIntegerBetween(value, 60, Number.MAX_SAFE_INTEGER) &&
          value % 2 === 0
      ),
      starting_angle: new NumberInputField(
        "Starting Angle",
        () => {
          return self.reconstruction.starting_angle;
        },
        self.setStartingAngle,
        StringInputFieldType.FLOAT,
        "Starting Angle must be an valid number.",
        -60,
        "Starting point of the tilt-series. E.g. if the projections are from -60 to 60 degrees, the starting point is -60."
      ),
      angle_step: new NumberInputField(
        "Angle Step",
        () => {
          return self.reconstruction.angle_step;
        },
        self.setAngleStep,
        StringInputFieldType.FLOAT,
        "Angle Step must be an valid number.",
        3,
        "Angle step between projections. E.g. if 3 the projections are -60, -57..., 57, 60."
      ),
      nlm_skip: new NumberInputField(
        "NLM Skip",
        () => {
          return self.reconstruction.nlm_skip;
        },
        self.setNlmSkip,
        StringInputFieldType.INTEGER,
        "NLM Skip must be an integer between 1 and 9.",
        3,
        "To skip some of the pixels in the search region during NLM. 3 provides almost the same result as no skip, but much faster.",
        (value: number) => Utils.isIntegerBetween(value, 1, 9)
      ),
    },
    alignmentInputs: {
      peak: new NumberInputField(
        "Peak",
        () => {
          return self.alignment.peak;
        },
        self.setPeak,
        StringInputFieldType.FLOAT,
        "Peak must be a valid number.",
        10,
        "Criterion # of SDs above local mean for erasing peak based on intensity."
      ),
      diff: new NumberInputField(
        "Difference",
        () => {
          return self.alignment.diff;
        },
        self.setDiff,
        StringInputFieldType.FLOAT,
        "Difference must be a valid number.",
        10,
        "Criterion # of SDs above mean pixel-to-pixel difference for erasing a peak based on differences."
      ),
      grow: new NumberInputField(
        "Grow",
        () => {
          return self.alignment.grow;
        },
        self.setGrow,
        StringInputFieldType.FLOAT,
        "Grow must be a valid number.",
        4,
        "Criterion # of SDs above mean for adding points to peak."
      ),
      iterations: new NumberInputField(
        "Iterations",
        () => {
          return self.alignment.iterations;
        },
        self.setIterationsAlignment,
        StringInputFieldType.INTEGER,
        "Iterations must be a positive integer.",
        3,
        "Number of times to iterate search for peaks.  For a given section, the iterations will be terminated after an iteration with no changes. Moreover, the program will keep track of which scan regions have changes on each iteration and stop redoing regions that have had no changes",
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
      numOfPatches: new NumberInputField(
        "Number of Patches",
        () => {
          return self.alignment.numOfPatches;
        },
        self.setNumOfPatches,
        StringInputFieldType.INTEGER,
        "Number of Patches must be a positive integer.",
        4,
        "Number of patches in X and Y to track by correlation.  The given number of patches will be regularly spaced apart and fill the X and Y ranges of the trimmed image area.",
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
      patchSize: new NumberInputField(
        "Patch Size",
        () => {
          return self.alignment.patchSize;
        },
        self.setPatchSizeAlignment,
        StringInputFieldType.INTEGER,
        "Patch Size must be a positive integer.",
        680,
        "Size in X and Y of patches to track by correlation.",
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
      patchRadius: new NumberInputField(
        "Patch Radius",
        () => {
          return self.alignment.patchRadius;
        },
        self.setPatchRadius,
        StringInputFieldType.FLOAT,
        "Patch Radius must be between 0 and 0.5.",
        0.125,
        "Low spatial frequencies in the cross-correlation will be attenuated by a Gaussian curve that is 1 at this cutoff radius and falls off below this radius with a standard deviation.",
        (value: number) => Utils.isFloatBetween(value, 0, 0.5)
      ),
      rotationAngle: new NumberInputField(
        "Rotation Angle",
        () => {
          return self.alignment.rotationAngle;
        },
        self.setRotationAngle,
        StringInputFieldType.FLOAT,
        "Rotation Angle must be a valid number.",
        60,
        "Angle of rotation of the tilt axis in the images; specifically, the angle from the vertical to the tilt axis (counterclockwise positive)."
      ),
    },
    ctfInputs: {
      highTension: new NumberInputField(
        "High Tension (keV)",
        () => {
          return self.ctf.highTension;
        },
        self.setHighTensionCTF,
        StringInputFieldType.FLOAT,
        "High Tension must be a valid number.",
        300,
        null
      ),
      sphericalAberration: new NumberInputField(
        "Spherical Aberration (Cs in mm)",
        () => {
          return self.ctf.sphericalAberration;
        },
        self.setSphericalAberration,
        StringInputFieldType.FLOAT,
        "Spherical Aberration must be a valid number.",
        2.7,
        null
      ),
      amplitudeContrast: new NumberInputField(
        "Amplitude Contrast",
        () => {
          return self.ctf.amplitudeContrast;
        },
        self.setAmplitudeContrast,
        StringInputFieldType.FLOAT,
        "Amplitude Contrast must be a valid number.",
        0.1,
        null
      ),
      pixelSize: new NumberInputField(
        "Pixel Size (Angstroms)",
        () => {
          return self.ctf.pixelSize;
        },
        self.setPixelSizeCTF,
        StringInputFieldType.FLOAT,
        "Pixel Size must be a valid number.",
        1.0,
        null
      ),
      tileSize: new NumberInputField(
        "Tile Size (pixels)",
        () => {
          return self.ctf.tileSize;
        },
        self.setTileSize,
        StringInputFieldType.INTEGER,
        "Tile Size must be a positive integer.",
        512,
        null,
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
    },
    motionCorrectionInputs: {
      patchSize: new NumberInputField(
        "Patch Size (pixels)",
        () => {
          return self.motionCorrection.patchSize;
        },
        self.setPatchSizeMotion,
        StringInputFieldType.INTEGER,
        "Patch Size must be a positive integer.",
        32,
        null,
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
      iterations: new NumberInputField(
        "Iterations",
        () => {
          return self.motionCorrection.iterations;
        },
        self.setIterationsMotion,
        StringInputFieldType.INTEGER,
        "Iterations must be a positive integer.",
        10,
        "Maximum iterations for iterative alignment.",
        (value: number) =>
          Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
      ),
      tolerance: new NumberInputField(
        "Tolerance",
        () => {
          return self.motionCorrection.tolerance;
        },
        self.setTolerance,
        StringInputFieldType.FLOAT,
        "Tolerance must be a valid number.",
        0.1,
        "Tolerance for iterative alignment."
      ),
      pixelSize: new NumberInputField(
        "Pixel Size (Angstroms)",
        () => {
          return self.motionCorrection.pixelSize;
        },
        self.setPixelSizeMotion,
        StringInputFieldType.FLOAT,
        "Pixel Size must be a valid number.",
        1.0,
        null
      ),
      fmDose: new NumberInputField(
        "Frame dose (e/A^2)",
        () => {
          return self.motionCorrection.fmDose;
        },
        self.setFmDose,
        StringInputFieldType.FLOAT,
        "FM Dose must be a valid number.",
        0,
        null
      ),
      highTension: new NumberInputField(
        "High Tension (keV)",
        () => {
          return self.motionCorrection.highTension;
        },
        self.setHighTensionMotion,
        StringInputFieldType.FLOAT,
        "High Tension must be a valid number.",
        300,
        "High tension in keV needed for dose weighting."
      ),
    },
  }))
  .views((self) => ({
    get reconstructionValid() {
      return (
        self.reconstructionInputs.tiled.isValid() &&
        self.reconstructionInputs.crop.isValid() &&
        self.reconstructionInputs.is_data_linearized.isValid() &&
        self.reconstructionInputs.delinearize_result.isValid() &&
        self.reconstructionInputs.data_term_end.isValid() &&
        self.reconstructionInputs.data_term_iters.isValid() &&
        self.reconstructionInputs.proximal_iters.isValid() &&
        self.reconstructionInputs.sample_rate.isValid() &&
        self.reconstructionInputs.chill_factor.isValid() &&
        self.reconstructionInputs.lambda.isValid() &&
        self.reconstructionInputs.number_extra_rows.isValid() &&
        self.reconstructionInputs.starting_angle.isValid() &&
        self.reconstructionInputs.angle_step.isValid() &&
        self.reconstructionInputs.nlm_skip.isValid()
      );
    },
    get alignmentValid() {
      return (
        self.alignmentInputs.peak.isValid() &&
        self.alignmentInputs.diff.isValid() &&
        self.alignmentInputs.grow.isValid() &&
        self.alignmentInputs.iterations.isValid() &&
        self.alignmentInputs.numOfPatches.isValid() &&
        self.alignmentInputs.patchSize.isValid() &&
        self.alignmentInputs.patchRadius.isValid() &&
        self.alignmentInputs.rotationAngle.isValid()
      );
    },
    get ctfValid() {
      return (
        self.ctfInputs.highTension.isValid() &&
        self.ctfInputs.sphericalAberration.isValid() &&
        self.ctfInputs.amplitudeContrast.isValid() &&
        self.ctfInputs.pixelSize.isValid() &&
        self.ctfInputs.tileSize.isValid()
      );
    },
    get motionValid() {
      return (
        self.motionCorrectionInputs.patchSize.isValid() &&
        self.motionCorrectionInputs.iterations.isValid() &&
        self.motionCorrectionInputs.tolerance.isValid() &&
        self.motionCorrectionInputs.pixelSize.isValid() &&
        self.motionCorrectionInputs.fmDose.isValid() &&
        self.motionCorrectionInputs.highTension.isValid()
      );
    },
  }));

export interface TiltSeriesDialogInstance extends Instance<
  typeof TiltSeriesDialog
> {}
export interface TiltSeriesDialogSnapshotIn extends SnapshotIn<
  typeof TiltSeriesDialog
> {}
