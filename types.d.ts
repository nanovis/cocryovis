import { Session } from "express-session";

declare module "express-session" {
    interface SessionData {
        user?: import("./models/user.mjs").PublicUser;
    }
}

interface TrainingOptions {
    minEpochs?: number;
    maxEpochs?: number;
    findLearningRate?: boolean;
    learningRate?: number;
    batchSize?: number;
    loss?: string;
    optimizer?: string;
    accumulateGradients?: number;
    checkpointId?: number;
}

interface ReconstructionOptions {
    volume_depth?: number;
    tiled?: boolean;
    crop?: boolean;
    is_data_linearized?: boolean;
    delinearize_result?: boolean;
    data_term_end?: boolean;
    data_term_iters?: number;
    proximal_iters?: number;
    sample_rate?: number;
    chill_factor?: number;
    lambda?: number;
    number_extra_rows?: number;
    starting_angle?: number;
    angle_step?: number;
    nlm_skip?: number;
}

interface IMODOptions {
    peak?: number;
    diff?: number;
    grow?: number;
    iterations?: number;
    numOfPatches?: number;
    patchSize?: number;
    patchRadius?: number;
    rotationAngle?: number;
}

interface CTFOptions {
    highTension?: number;
    sphericalAberration?: number;
    amplitudeContrast?: number;
    pixelSize?: number;
    tileSize?: number;
}

interface MotionCorrectionOptions {
    patchSize?: number;
    iterations?: number;
    tolerance?: number;
    pixelSize?: number;
    fmDose?: number;
    highTension?: number;
}
interface TiltSeriesOptions {
    reconstruction?: ReconstructionOptions;
    alignment?: IMODOptions;
    ctf?: CTFOptions;
    motionCorrection?: MotionCorrectionOptions;
}
