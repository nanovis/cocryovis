import {
  flow,
  getParentOfType,
  Instance,
  SnapshotIn,
  types,
  isAlive,
} from "mobx-state-tree";
import { Volume, VolumeInstance } from "./VolumeModel";
import { User } from "./UserModel";
import { Model, ModelInstance } from "./ModelModel";
import Utils from "../../utils/Helpers";
import { toast } from "react-toastify";
import {
  BooleanInputField,
  DropdownInputField,
  NumberInputField,
  StringInputFieldType,
} from "../../utils/Input";

export enum lossOptions {
  mse = "Mean Squared Error",
  bce = "Binary Cross Entropy",
  awl = "Adaptive Weighted Loss",
}

export enum optimizerOptions {
  Adam = "Adam",
  Ranger = "Ranger",
}

export const ModelTraining = types
  .model({
    model: types.maybe(types.reference(Model)),
    checkpointId: types.maybe(types.integer),
    trainingVolumes: types.optional(types.array(types.reference(Volume)), []),
    validationVolumes: types.optional(types.array(types.reference(Volume)), []),
    testingVolumes: types.optional(types.array(types.reference(Volume)), []),
    minEpochs: types.optional(types.string, ""),
    maxEpochs: types.optional(types.string, ""),
    findLearningRate: types.optional(types.boolean, false),
    learningRate: types.optional(types.string, ""),
    batchSize: types.optional(types.string, ""),
    loss: types.optional(types.string, "mse"),
    optimizer: types.optional(types.string, "Adam"),
    accumulateGradients: types.optional(types.string, ""),
  })
  .actions((self) => ({
    setModel(model: ModelInstance) {
      self.model = model;
    },
    setCheckpointId(checkpointId: number | undefined) {
      self.checkpointId = checkpointId;
    },
    addTrainingVolume(volume: VolumeInstance) {
      if (!self.trainingVolumes.includes(volume)) {
        self.trainingVolumes.push(volume);
      }
    },
    removeTrainingVolume(volume: VolumeInstance) {
      const index = self.trainingVolumes.findIndex((v) => v.id === volume.id);
      if (index !== -1) {
        self.trainingVolumes.splice(index, 1);
      }
    },
    removeTrainingVolumeByIndex(index: number) {
      if (index < 0 || index >= self.trainingVolumes.length) {
        return;
      }
      self.trainingVolumes.splice(index, 1);
    },
    addValidationVolume(volume: VolumeInstance) {
      if (!self.validationVolumes.includes(volume)) {
        self.validationVolumes.push(volume);
      }
    },
    removeValidationVolume(volume: VolumeInstance) {
      const index = self.validationVolumes.findIndex((v) => v.id === volume.id);
      if (index !== -1) {
        self.validationVolumes.splice(index, 1);
      }
    },
    removeValidationVolumeByIndex(index: number) {
      if (index < 0 || index >= self.validationVolumes.length) {
        return;
      }
      self.validationVolumes.splice(index, 1);
    },
    addTestingVolume(volume: VolumeInstance) {
      if (!self.testingVolumes.includes(volume)) {
        self.testingVolumes.push(volume);
      }
    },
    removeTestingVolume(volume: VolumeInstance) {
      const index = self.testingVolumes.findIndex((v) => v.id === volume.id);
      if (index !== -1) {
        self.testingVolumes.splice(index, 1);
      }
    },
    removeTestingVolumeByIndex(index: number) {
      if (index < 0 || index >= self.testingVolumes.length) {
        return;
      }
      self.testingVolumes.splice(index, 1);
    },
    setMinEpochs(minEpochs: string) {
      self.minEpochs = minEpochs;
    },
    setMaxEpochs(maxEpochs: string) {
      self.maxEpochs = maxEpochs;
    },
    setFindLearningRate(findLeatningRate: boolean) {
      self.findLearningRate = findLeatningRate;
    },
    setLearningRate(learningRate: string) {
      self.learningRate = learningRate;
    },
    setBatchSize(batchSize: string) {
      self.batchSize = batchSize;
    },
    setLoss(loss: string) {
      self.loss = loss;
    },
    setOptimizer(optimizer: string) {
      self.optimizer = optimizer;
    },
    setAccumulateGradients(accumulateGradients: string) {
      self.accumulateGradients = accumulateGradients;
    },
  }))
  .volatile((self) => ({
    isBusy: false,

    minEpochsInput: new NumberInputField(
      "Minimum Epochs",
      () => {
        return self.minEpochs;
      },
      self.setMinEpochs,
      StringInputFieldType.INTEGER,
      "Must be an integer greater than 0.",
      50,
      null,
      (value: number) => {
        return value > 0;
      }
    ),
    learningRateInput: new NumberInputField(
      "Learning Rate",
      () => {
        return self.learningRate;
      },
      self.setLearningRate,
      StringInputFieldType.FLOAT,
      "Must be greater than 0.",
      1e-3,
      null,
      (value: number) => {
        return value > 0;
      }
    ),
    findLearningRateInput: new BooleanInputField(
      "Find Learning Rate",
      () => {
        return self.findLearningRate;
      },
      self.setFindLearningRate,
      false
    ),
    batchSizeInput: new NumberInputField(
      "Batch Size",
      () => {
        return self.batchSize;
      },
      self.setBatchSize,
      StringInputFieldType.INTEGER,
      "Must be an integer greater than 0.",
      4,
      null,
      (value: number) => {
        return value > 0;
      }
    ),
    accumulateGradientsInput: new NumberInputField(
      "Accumulate Gradients",
      () => {
        return self.accumulateGradients;
      },
      self.setAccumulateGradients,
      StringInputFieldType.INTEGER,
      "Must be an integer greater than 0.",
      1,
      null,
      (value: number) => {
        return value > 0;
      }
    ),
    lossInput: new DropdownInputField(
      "Loss",
      () => {
        return self.loss;
      },
      self.setLoss,
      lossOptions,
      "mse"
    ),
    optimizerInput: new DropdownInputField(
      "Optimizer",
      () => {
        return self.optimizer;
      },
      self.setOptimizer,
      optimizerOptions,
      "Adam"
    ),
  }))
  .volatile((self) => ({
    maxEpochsInput: new NumberInputField(
      "Maximum Epochs",
      () => {
        return self.maxEpochs;
      },
      self.setMaxEpochs,
      StringInputFieldType.INTEGER,
      "Must be an integer greater than min. epochs.",
      150,
      null,
      (value: number) => {
        return value > 0 && value >= self.minEpochsInput.convertToValue();
      }
    ),
  }))
  .views((self) => ({
    get volumes(): VolumeInstance[] {
      const userProjects = getParentOfType(self, User)?.userProjects;
      return userProjects?.activeProject?.projectVolumes.volumeArray || [];
    },
  }))
  .views((self) => ({
    get canDoTraining() {
      return (
        !self.isBusy &&
        self.model !== undefined &&
        self.trainingVolumes.length > 0 &&
        self.validationVolumes.length > 0 &&
        self.testingVolumes.length > 0 &&
        self.minEpochsInput.isValid() &&
        self.maxEpochsInput.isValid() &&
        self.learningRateInput.isValid() &&
        self.batchSizeInput.isValid() &&
        self.lossInput.isValid() &&
        self.optimizerInput.isValid() &&
        self.accumulateGradientsInput.isValid()
      );
    },
    get trainingVolumeOptions() {
      return self.volumes.filter(
        (volume) =>
          !self.validationVolumes.includes(volume) &&
          !self.testingVolumes.includes(volume)
      );
    },
    get trainingVolumeNames() {
      return self.trainingVolumes.map((volume) => volume.name);
    },
    get trainingVolumeIds() {
      return self.trainingVolumes.map((volume) => volume.id.toString());
    },
    get validationVolumeOptions() {
      return self.volumes.filter(
        (volume) =>
          !self.trainingVolumes.includes(volume) &&
          !self.testingVolumes.includes(volume)
      );
    },
    get validationVolumeNames() {
      return self.validationVolumes.map((volume) => volume.name);
    },
    get validationVolumeIds() {
      return self.validationVolumes.map((volume) => volume.id.toString());
    },
    get testingVolumeOptions() {
      return self.volumes.filter(
        (volume) =>
          !self.trainingVolumes.includes(volume) &&
          !self.validationVolumes.includes(volume)
      );
    },
    get testingVolumeNames() {
      return self.testingVolumes.map((volume) => volume.name);
    },
    get testingVolumeIds() {
      return self.testingVolumes.map((volume) => volume.id.toString());
    },
  }))
  .actions((self) => ({
    startTraining: flow(function* () {
      if (!self.canDoTraining) {
        return;
      }
      let toastId = null;
      try {
        toastId = toast.loading("Training in progress...");
        self.isBusy = true;

        if (
          self.checkpointId === undefined &&
          self.model &&
          self.model?.modelCheckpoints.checkpoints.size > 0
        ) {
          throw new Error(
            "If a checkpoint is not selected, the chosen model must be empty"
          );
        }

        //prettier-ignore
        const trainData: Record<string, any> = {
          modelId: self.model?.id,
          trainingVolumes: self.trainingVolumeIds,
          validationVolumes: self.validationVolumeIds,
          testingVolumes: self.testingVolumeIds,
          minEpochs: self.minEpochsInput.convertToValue(),
          maxEpochs: self.maxEpochsInput.convertToValue(),
          findLearningRate: self.findLearningRateInput.convertToValue(),
          learningRate: self.learningRateInput.convertToValue(),
          batchSize: self.batchSizeInput.convertToValue(),
          loss: self.lossInput.convertToValue(),
          optimizer: self.optimizerInput.convertToValue(),
          accumulateGradients: self.accumulateGradientsInput.convertToValue(),
        };

        if (self.checkpointId !== undefined) {
          trainData.checkpointId = self.checkpointId;
        }

        yield Utils.sendReq(
          `queue-training`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trainData),
          },
          false
        );
        if (!isAlive(self)) {
          return;
        }
        toast.update(toastId, {
          render: "Training queued successfuly!",
          type: "success",
          isLoading: false,
          autoClose: 2000,
        });
      } catch (error) {
        console.error("startTraining Error:", error);
        Utils.updateToastWithErrorMsg(toastId, error);
      } finally {
        self.isBusy = false;
      }
    }),
  }));

export interface ModelTrainingInstance extends Instance<typeof ModelTraining> {}
export interface ModelTrainingSnapshotIn
  extends SnapshotIn<typeof ModelTraining> {}
