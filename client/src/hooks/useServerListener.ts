import { useEffect } from "react";
import { useWebSocketConnection } from "./useWebSocketConnection";
import { UserInstance } from "../stores/userState/UserModel";
import { PseudoVolumeSnapshotIn } from "../stores/userState/PseudoVolumeModel";
import { ResultSnapshotIn } from "../stores/userState/ResultModel";
import { CheckpointSnapshotIn } from "../stores/userState/CheckpointModel";
import { TaskHistorySnapshotIn } from "../stores/userState/Status";
import { RawVolumeSnapshotIn } from "../stores/userState/RawVolumeModel";

interface PseudoVolumeUpdate {
  volumeId: number;
  pseudoLabeledVolumes: PseudoVolumeSnapshotIn[];
}

interface ResultUpdate {
  volumeId: number;
  result: ResultSnapshotIn;
}

interface CheckpointUpdate {
  modelId: number;
  checkpoint: CheckpointSnapshotIn;
}

interface RawDataUpdate {
  volumeId: number;
  rawData: RawVolumeSnapshotIn;
}

type Response =
  | { actionType: "InsertPseudoVolumes"; actionContent: PseudoVolumeUpdate }
  | { actionType: "InsertResult"; actionContent: ResultUpdate }
  | { actionType: "InsertCheckpoint"; actionContent: CheckpointUpdate }
  | { actionType: "AddRawData"; actionContent: RawDataUpdate }
  | { actionType: "InsertTaskHistory"; actionContent: TaskHistorySnapshotIn }
  | { actionType: "CPUQueueUpdated"; actionContent: TaskHistorySnapshotIn[] }
  | { actionType: "GPUQueueUpdated"; actionContent: TaskHistorySnapshotIn[] };

export function useServerListener(websocketUrl: string, user: UserInstance) {
  const shouldReconnect = () => {
    return !user.isGuest;
  };

  const { lastJsonMessage, connectionStatus } = useWebSocketConnection(
    websocketUrl,
    shouldReconnect
  );

  useEffect(() => {
    const action = lastJsonMessage as Response;
    if (!action || !action.actionType) {
      return;
    }

    console.log(action)

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

  const handleInsertPseudoVolumes = (contents: PseudoVolumeUpdate) => {
    user?.userProjects.projects.forEach((project) => {
      const volume = project.projectVolumes.volumes.get(contents.volumeId);
      volume?.addPseudoVolumes(contents.pseudoLabeledVolumes);
    });
  };

  const handleInsertResult = (contents: ResultUpdate) => {
    user?.userProjects.projects.forEach((project) => {
      const volume = project.projectVolumes.volumes.get(contents.volumeId);
      volume?.volumeResults.addResult(contents.result);
    });
  };

  const handleInsertCheckpoint = (contents: CheckpointUpdate) => {
    user?.userProjects.projects.forEach((project) => {
      const model = project.projectModels.models.get(contents.modelId);
      model?.modelCheckpoints.addCheckpoint(contents.checkpoint);
    });
  };

  const handleAddRawData = (contents: RawDataUpdate) => {
    user?.userProjects.projects.forEach((project) => {
      const volume = project.projectVolumes.volumes.get(contents.volumeId);
      volume?.setRawVolume(contents.rawData);
    });
  };

  const handleInsertTaskHistory = (contents: TaskHistorySnapshotIn) => {
    user.status?.appendTaskHistory(contents);
  };

  const handleCPUQueueUpdated = (contents: TaskHistorySnapshotIn[]) => {
    user.status?.setCPUTaskQueue(contents);
  };

  const handleGPUQueueUpdated = (contents: TaskHistorySnapshotIn[]) => {
    user.status?.setGPUTaskQueue(contents);
  };

  return connectionStatus;
}
