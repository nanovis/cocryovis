import { Instance, SnapshotIn, types } from "mobx-state-tree";
import Utils from "../../functions/Utils";
import {
  BooleanInputField,
  NumberInputField,
  StringInputFieldType,
} from "../../functions/Input";

export const TiltSeriesDialog = types
  .model({
    pendingFile: types.frozen<File | null>(null),
    volumeDepth: types.optional(types.string, ""),
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
  })
  .actions((self) => ({
    setPendingFile: (file: File | null) => {
      self.pendingFile = file;
    },
    setVolumeDepth: (value: string) => {
      self.volumeDepth = value;
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
  }))
  .volatile((self) => ({
    isBusy: false,
    volumeDepthInput: new NumberInputField(
      "Volume Depth",
      () => {
        return self.volumeDepth;
      },
      self.setVolumeDepth,
      StringInputFieldType.INTEGER,
      "Volume Depth must be a positive integer.",
      50,
      null,
      (value: number) =>
        Utils.isIntegerBetween(value, 1, Number.MAX_SAFE_INTEGER)
    ),

    reconstructionInputs: {
      tiledInput: new BooleanInputField(
        "Minimum Epochs",
        () => {
          return self.reconstruction.tiled;
        },
        self.setTiled,
        true,
        "Whether the computation is done by tiles."
      ),
      cropInput: new BooleanInputField(
        "Crop",
        () => {
          return self.reconstruction.crop;
        },
        self.setCrop,
        true,
        "Whether the results are cropped before saving."
      ),
      isDataLinearizedInput: new BooleanInputField(
        "Linearized Data",
        () => {
          return self.reconstruction.is_data_linearized;
        },
        self.setIsDataLinearized,
        false,
        "Whether the tilt series has been linearized previously."
      ),
      delinearizeResultInput: new BooleanInputField(
        "Delinerize Result",
        () => {
          return self.reconstruction.delinearize_result;
        },
        self.setDelinearizeResult,
        true,
        "Whether the results are delinearized before saving."
      ),
      dataTermEndInput: new BooleanInputField(
        "Run Final Data Term Operation",
        () => {
          return self.reconstruction.data_term_end;
        },
        self.setDataTermEnd,
        false,
        "Whether a final data term operation is run at the end of reconstruction."
      ),
      dataTermItersInput: new NumberInputField(
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
      proximalItersInput: new NumberInputField(
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
      sampleRateInput: new NumberInputField(
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
      chillFactorInput: new NumberInputField(
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
      lambdaInput: new NumberInputField(
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
      numberExtraRowsInput: new NumberInputField(
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
          Number(value) % 2 === 0
      ),
      startingAngleInput: new NumberInputField(
        "Starting Angle",
        () => {
          return self.reconstruction.starting_angle;
        },
        self.setStartingAngle,
        StringInputFieldType.FLOAT,
        "Starting Angle must be an valid number.",
        -60,
        "Starting point of the tilt-series. E.g. if the projections are from -60 to 60 degrees, the starting point is -60.",
        (value: number) => Utils.isFloat(value)
      ),
      angleStepInput: new NumberInputField(
        "Angle Step",
        () => {
          return self.reconstruction.angle_step;
        },
        self.setAngleStep,
        StringInputFieldType.FLOAT,
        "Angle Step must be an valid number.",
        3,
        "Angle step between projections. E.g. if 3 the projections are -60, -57..., 57, 60.",
        (value: number) => Utils.isFloat(value)
      ),
      nlmSkipInput: new NumberInputField(
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
  }))
  .views((self) => ({
    get reconstructionValid() {
      return (
        self.reconstructionInputs.dataTermItersInput.isValid() &&
        self.reconstructionInputs.proximalItersInput.isValid() &&
        self.reconstructionInputs.sampleRateInput.isValid() &&
        self.reconstructionInputs.chillFactorInput.isValid() &&
        self.reconstructionInputs.lambdaInput.isValid() &&
        self.reconstructionInputs.numberExtraRowsInput.isValid() &&
        self.reconstructionInputs.startingAngleInput.isValid() &&
        self.reconstructionInputs.angleStepInput.isValid() &&
        self.reconstructionInputs.nlmSkipInput.isValid()
      );
    },
  }));

export interface TiltSeriesDialogInstance
  extends Instance<typeof TiltSeriesDialog> {}
export interface TiltSeriesDialogSnapshotIn
  extends SnapshotIn<typeof TiltSeriesDialog> {}
