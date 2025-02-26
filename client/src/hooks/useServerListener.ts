import { useEffect } from "react";
import { useWebSocketConnection } from "./useWebSocketConnection";
import { UserInstance } from "../stores/userState/UserModel";
import { PseudoVolumeSnapshotIn } from "../stores/userState/PseudoVolumeModel";
import { ResultSnapshotIn } from "../stores/userState/ResultModel";
import { CheckpointSnapshotIn } from "../stores/userState/CheckpointModel";
import { TaskHistorySnapshotIn } from "../stores/userState/Status";
import { RawVolumeSnapshotIn } from "../stores/userState/RawVolumeModel";

export function useServerListener(
  websocketUrl: string,
  user: UserInstance | undefined
) {
  const shouldReconnect = () => {
    return !!user;
  };

  const { lastMessage, lastJsonMessage, connectionStatus } =
    useWebSocketConnection(websocketUrl, shouldReconnect);

  useEffect(() => {
    const action = lastJsonMessage as { actionType?: any; actionContent?: any };
    if (!action || !action.actionType) {
      return;
    }

    switch (action.actionType) {
      case "InsertPseudoVolumes":
        handleInsertPseudoVolumes(action.actionContent);
        break;
      case "InsertResult":
        handleInsertResult(action.actionContent);
        break;
      case "InsertCheckpoint":
        handleInsertCheckpoint(action.actionContent);
        break;
      case "AddRawData":
        handleAddRawData(action.actionContent);
        break;
      case "InsertTaskHistory":
        handleInsertTaskHistory(action.actionContent);
        break;
      case "CPUQueueUpdated":
        handleCPUQueueUpdated(action.actionContent);
        break;
      case "GPUQueueUpdated":
        handleGPUQueueUpdated(action.actionContent);
        break;
    }
  }, [lastJsonMessage]);

  const handleInsertPseudoVolumes = (contents: {
    volumeId: number;
    pseudoLabeledVolumes: PseudoVolumeSnapshotIn[];
  }) => {
    user?.userProjects.projects.forEach((project) => {
      const volume = project.projectVolumes.volumes.get(contents.volumeId);
      volume?.addPseudoVolumes(contents.pseudoLabeledVolumes);
    });
  };

  const handleInsertResult = (contents: {
    volumeId: number;
    result: ResultSnapshotIn;
  }) => {
    user?.userProjects.projects.forEach((project) => {
      const volume = project.projectVolumes.volumes.get(contents.volumeId);
      volume?.volumeResults.addResult(contents.result);
    });
  };

  const handleInsertCheckpoint = (contents: {
    modelId: number;
    checkpoint: CheckpointSnapshotIn;
  }) => {
    user?.userProjects.projects.forEach((project) => {
      const model = project.projectModels.models.get(contents.modelId);
      model?.modelCheckpoints.addCheckpoint(contents.checkpoint);
    });
  };

  const handleAddRawData = (contents: {
    volumeId: number;
    rawData: RawVolumeSnapshotIn;
  }) => {
    user?.userProjects.projects.forEach((project) => {
      const volume = project.projectVolumes.volumes.get(contents.volumeId);
      volume?.setRawVolume(contents.rawData);
    });
  };

  const handleInsertTaskHistory = (contents: TaskHistorySnapshotIn) => {
    user?.status.appendTaskHistory(contents);
  };

  const handleCPUQueueUpdated = (contents: TaskHistorySnapshotIn[]) => {
    user?.status.setCPUTaskQueue(contents);
  };

  const handleGPUQueueUpdated = (contents: TaskHistorySnapshotIn[]) => {
    user?.status.setGPUTaskQueue(contents);
  };

  return connectionStatus;
}
