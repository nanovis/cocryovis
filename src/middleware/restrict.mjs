// @ts-check

import { ApiError } from "../tools/error-handler.mjs";
import Project from "../models/project.mjs";
import {
    VolumeDataFactory,
    VolumeDataType,
} from "../models/volume-data-factory.mjs";
import Volume from "../models/volume.mjs";
import Model from "../models/model.mjs";
import Checkpoint from "../models/checkpoint.mjs";
import Result from "../models/result.mjs";

/**
 * @typedef { import("@prisma/client").Project } ProjectDB
 * @typedef { import("@prisma/client").Volume } VolumeDB
 */

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function restrictApi(req, res, next) {
    if (!req.session || !req.session.user) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }
    next();
}

/**
 * @param {import("../models/project.mjs").ProjectDB} project
 * @param {number | undefined} userId
 */
async function userHasReadAccessToProject(project, userId) {
    if (project.publicAccess === 1) {
        return true;
    }
    if (!userId) {
        return false;
    }
    if (project.ownerId === userId) {
        return true;
    }
    const projectAccess = await Project.getUserAccessInfo(project.id, userId);
    if (projectAccess >= 0) {
        return true;
    }
    return false;
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function restrictReadProjectAccess(req, res, next) {
    const projectId = Number(req.params.idProject);
    const project = await Project.getById(projectId);
    if (!project) {
        throw new ApiError(404, `Project ${projectId} not found!`);
    }
    if (!userHasReadAccessToProject(project, req.session?.user?.id)) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }
    next();
}

// VOLUME

/**
 * @param {number} volumeId
 * @param {number | undefined} userId
 */
async function userHasReadAccessToVolume(volumeId, userId) {
    const volume = await Volume.getById(volumeId, { projects: true });
    if (!volume) {
        throw new ApiError(404, `Volume ${volumeId} not found!`);
    }
    for (const project of volume.projects) {
        if (await userHasReadAccessToProject(project, userId)) {
            return true;
        }
    }

    return false;
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function restrictReadVolumeAccess(req, res, next) {
    const volumeId = Number(req.params.idVolume);

    if (!userHasReadAccessToVolume(volumeId, req.session?.user?.id)) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }

    next();
}

// VOLUME DATA

/**
 * @param {number} volumeDataId
 * @param {VolumeDataType} volumeDataType
 * @param {number | undefined} userId
 */
async function userHasReadAccessToVolumeData(
    volumeDataId,
    volumeDataType,
    userId
) {
    const volumes = await VolumeDataFactory.getClass(volumeDataType).getVolumes(
        volumeDataId
    );
    if (!volumes) {
        return false;
    }
    for (const volume of volumes) {
        if (await userHasReadAccessToVolume(volume.id, userId)) {
            return true;
        }
    }

    return false;
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function restrictReadVolumeDataAccess(req, res, next) {
    const volumeDataId = Number(req.params.idVolumeData);
    const volumeDataType = req.params.type;

    if (
        !userHasReadAccessToVolumeData(
            volumeDataId,
            VolumeDataType.mapName(volumeDataType),
            req.session?.user?.id
        )
    ) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }

    next();
}

// RESULT

/**
 * @param {number} resultId
 * @param {number | undefined} userId
 */
async function userHasReadAccessToResult(resultId, userId) {
    const volumes = await Result.getVolumes(resultId);
    if (!volumes) {
        return false;
    }
    for (const volume of volumes) {
        if (await userHasReadAccessToVolume(volume.id, userId)) {
            return true;
        }
    }

    return false;
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function restrictReadResultAccess(req, res, next) {
    const resultId = Number(req.params.idResult);

    if (!userHasReadAccessToResult(resultId, req.session?.user?.id)) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }

    next();
}

// MODEL

/**
 * @param {number} modelId
 * @param {number | undefined} userId
 */
async function userHasReadAccessToModel(modelId, userId) {
    const model = await Model.getById(modelId, { projects: true });
    if (!model) {
        throw new ApiError(404, `Volume ${modelId} not found!`);
    }
    for (const project of model.projects) {
        if (await userHasReadAccessToProject(project, userId)) {
            return true;
        }
    }

    return false;
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function restrictReadModelAccess(req, res, next) {
    const modelId = Number(req.params.idModel);

    if (!userHasReadAccessToModel(modelId, req.session?.user?.id)) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }

    next();
}

// CHECKPOINT

/**
 * @param {number} checkpointId
 * @param {number | undefined} userId
 */
async function userHasReadAccessToCheckpoint(checkpointId, userId) {
    const models = await Checkpoint.getModels(checkpointId);
    if (!models) {
        return false;
    }
    for (const model of models) {
        if (await userHasReadAccessToModel(model.id, userId)) {
            return true;
        }
    }

    return false;
}

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function restrictReadCheckpointAccess(req, res, next) {
    const checkpointId = Number(req.params.idCheckpoint);

    if (!userHasReadAccessToCheckpoint(checkpointId, req.session?.user?.id)) {
        throw new ApiError(403, `Access to ${req.path} denied!`);
    }

    next();
}

// /**
//  * @param {number} volumeId
//  * @param {ProjectDB & {volumes: VolumeDB[]}} project
//  * @param {number | undefined} userId
//  */
// async function userHasReadAccessToVolume(volumeId, project, userId) {
//     if (!project.volumes.some((v) => v.id === volumeId)) {
//         return false;
//     }
//     return userHasReadAccessToProject(project, userId);
// }

// /**
//  * @param {import("express").Request} req
//  * @param {import("express").Response} res
//  * @param {import("express").NextFunction} next
//  */
// export async function restrictReadVolumeAccess(req, res, next) {
//     const projectId = Number(req.params.idProject);
//     const volumeId = Number(req.params.idVolume);
//     const project = await Project.getById(projectId);
//     if (!project) {
//         throw new ApiError(404, `Project ${projectId} not found!`);
//     }

//     if (!userHasReadAccessToVolume(volumeId, project, req.session?.user?.id)) {
//         throw new ApiError(403, `Access to ${req.path} denied!`);
//     }

//     next();
// }

// /**
//  * @param {number} volumeDataId
//  * @param {VolumeDataType} volumeDataType
//  * @param {number} volumeId
//  * @param {ProjectDB & {volumes: VolumeDB[]}} project
//  * @param {number | undefined} userId
//  */
// async function userHasReadAccessToVolumeData(
//     volumeDataId,
//     volumeDataType,
//     volumeId,
//     project,
//     userId
// ) {
//     const partOfVolume = await VolumeDataFactory.getClass(
//         volumeDataType
//     ).belongsToVolume(volumeDataId, volumeId);

//     if (!partOfVolume) {
//         return false;
//     }

//     return userHasReadAccessToVolume(volumeId, project, userId);
// }

// /**
//  * @param {import("express").Request} req
//  * @param {import("express").Response} res
//  * @param {import("express").NextFunction} next
//  */
// export async function restrictReadVolumeDataAccess(req, res, next) {
//     const projectId = Number(req.params.idProject);
//     const volumeId = Number(req.params.idVolume);
//     const volumeDataId = Number(req.params.idVolumeData);
//     const volumeDataType = req.params.volumeDataType;
//     const project = await Project.getById(projectId);
//     if (!project) {
//         throw new ApiError(404, `Project ${projectId} not found!`);
//     }

//     if (
//         !userHasReadAccessToVolumeData(
//             volumeDataId,
//             VolumeDataType.mapName(volumeDataType),
//             volumeId,
//             project,
//             req.session?.user?.id
//         )
//     ) {
//         throw new ApiError(403, `Access to ${req.path} denied!`);
//     }

//     next();
// }
