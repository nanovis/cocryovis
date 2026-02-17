import { useEffect, useRef } from "react";
import { useWebSocketConnection } from "./useWebSocketConnection";
import type { UserInstance } from "@/stores/userState/UserModel";
import type { PseudoVolumeSnapshotIn } from "@/stores/userState/PseudoVolumeModel";
import type { ResultSnapshotIn } from "@/stores/userState/ResultModel";
import type { CheckpointSnapshotIn } from "@/stores/userState/CheckpointModel";
import type { TaskHistorySnapshotIn } from "@/stores/userState/Status";
import type { RawVolumeSnapshotIn } from "@/stores/userState/RawVolumeModel";

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

const handleInsertPseudoVolumes = (
  user: UserInstance,
  contents: PseudoVolumeUpdate
) => {
  user.userProjects.projects.forEach((project) => {
    const volume = project.projectVolumes.volumes.get(contents.volumeId);
    volume?.addPseudoVolumes(contents.pseudoLabeledVolumes);
  });
};

const handleInsertResult = (user: UserInstance, contents: ResultUpdate) => {
  user.userProjects.projects.forEach((project) => {
    const volume = project.projectVolumes.volumes.get(contents.volumeId);
    volume?.volumeResults.addResult(contents.result);
  });
};

const handleInsertCheckpoint = (
  user: UserInstance,
  contents: CheckpointUpdate
) => {
  user.userProjects.projects.forEach((project) => {
    const model = project.projectModels.models.get(contents.modelId);
    model?.modelCheckpoints.addCheckpoint(contents.checkpoint);
  });
};

const handleAddRawData = (user: UserInstance, contents: RawDataUpdate) => {
  user.userProjects.projects.forEach((project) => {
    const volume = project.projectVolumes.volumes.get(contents.volumeId);
    volume?.setRawVolume(contents.rawData);
  });
};

const handleInsertTaskHistory = (
  user: UserInstance,
  contents: TaskHistorySnapshotIn
) => {
  user.status?.appendTaskHistory(contents);
};

const handleCPUQueueUpdated = (
  user: UserInstance,
  contents: TaskHistorySnapshotIn[]
) => {
  user.status?.setCPUTaskQueue(contents);
};

const handleGPUQueueUpdated = (
  user: UserInstance,
  contents: TaskHistorySnapshotIn[]
) => {
  user.status?.setGPUTaskQueue(contents);
};

export function useServerListener(websocketUrl: string, user: UserInstance) {
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const { lastJsonMessage, connectionStatus } = useWebSocketConnection(
    websocketUrl,
    !user.isGuest
  );

  useEffect(() => {
    const action = lastJsonMessage as Response;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!action?.actionType) {
      return;
    }

    console.log(action);

    switch (action.actionType) {
      case "InsertPseudoVolumes":
        handleInsertPseudoVolumes(userRef.current, action.actionContent);
        break;
      case "InsertResult":
        handleInsertResult(userRef.current, action.actionContent);
        break;
      case "InsertCheckpoint":
        handleInsertCheckpoint(userRef.current, action.actionContent);
        break;
      case "AddRawData":
        handleAddRawData(userRef.current, action.actionContent);
        break;
      case "InsertTaskHistory":
        handleInsertTaskHistory(userRef.current, action.actionContent);
        break;
      case "CPUQueueUpdated":
        handleCPUQueueUpdated(userRef.current, action.actionContent);
        break;
      case "GPUQueueUpdated":
        handleGPUQueueUpdated(userRef.current, action.actionContent);
        break;
    }
  }, [lastJsonMessage]);

  return connectionStatus;
}
