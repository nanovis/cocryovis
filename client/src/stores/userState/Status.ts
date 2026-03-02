import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, isAlive, types } from "mobx-state-tree";
import type z from "zod";
import { getGpuStatus, getStatus } from "@/api/users";
import type {
  gpuStatusSchema,
  statusSchema,
} from "@cocryovis/schemas/componentSchemas/status-schema";

export interface TaskHistoryItem {
  id: number;
  taskStatus: {
    id: number;
  };
  taskType: {
    label: string;
  };
  data: {
    volume: { id: number; name: string } | null | "deleted";
    model: { id: number; name: string } | null | "deleted";
    checkpoint?: { id: number; filePath: string | null } | null | "deleted";
  };
  enqueuedTime: {
    date: Date;
  };
  startTime: {
    date?: Date;
  };
  endTime: {
    date?: Date;
  };
  log: {
    path?: string;
  };
}

export interface TaskQueueItem {
  id: number;
  taskStatus: {
    ongoing: boolean;
  };
  taskType: {
    label: string;
  };
  user: {
    user: { id: number; username: string } | null;
  };
  enqueuedTime: {
    date: Date;
  };
  startTime: {
    date?: Date;
  };
}

export const TaskHistory = types.model({
  id: types.identifierNumber,
  taskType: types.integer,
  taskStatus: types.integer,
  logFile: types.maybeNull(types.string),
  enqueuedTime: types.Date,
  startTime: types.maybeNull(types.Date),
  endTime: types.maybeNull(types.Date),
  volume: types.optional(
    types.maybeNull(
      types.model({
        id: types.integer,
        name: types.string,
      })
    ),
    null
  ),
  model: types.optional(
    types.maybeNull(
      types.model({
        id: types.integer,
        name: types.string,
      })
    ),
    null
  ),
  checkpoint: types.optional(
    types.maybeNull(
      types.model({
        id: types.integer,
        filePath: types.maybeNull(types.string),
      })
    ),
    null
  ),
});

export interface TaskHistoryInstance extends Instance<typeof TaskHistory> {}
export interface TaskHistorySnapshotIn extends SnapshotIn<typeof TaskHistory> {}

export const TaskQueueElement = types.model({
  id: types.identifierNumber,
  taskType: types.integer,
  taskStatus: types.integer,
  user: types.optional(
    types.maybeNull(
      types.model({
        id: types.integer,
        username: types.string,
      })
    ),
    null
  ),
  enqueuedTime: types.Date,
  startTime: types.optional(types.maybeNull(types.Date), null),
});

export interface TaskQueueElementInstance extends Instance<
  typeof TaskQueueElement
> {}
export interface TaskQueueElementSnapshotIn extends SnapshotIn<
  typeof TaskQueueElement
> {}

enum Type {
  "Label Generation" = 0,
  "Training" = 1,
  "Inference" = 2,
  "Reconstruction" = 3,
}

function parseTaskQueueArray(
  taskQueue: TaskQueueElementInstance[]
): TaskQueueItem[] {
  return taskQueue.map((task) => ({
    id: task.id,
    taskStatus: {
      ongoing: task.taskStatus === 1,
    },
    taskType: {
      label: Type[task.taskType],
    },
    user: {
      user: task.user ?? null,
    },
    enqueuedTime: {
      date: task.enqueuedTime,
    },
    startTime: {
      date: task.startTime ?? undefined,
    },
  }));
}

export const Status = types
  .model({
    pageNumber: types.optional(types.integer, 1),
    pageSize: types.optional(types.integer, 10),
    taskHistoryLenght: types.optional(types.integer, 0),
    taskHistory: types.map(TaskHistory),
    cpuTaskQueue: types.array(TaskQueueElement),
    gpuTaskQueue: types.array(TaskQueueElement),
    freeGpus: types.optional(types.integer, 0),
    totalGpus: types.optional(types.integer, 0),
  })
  .volatile(() => ({
    activeRequests: 0,
  }))
  .views((self) => ({
    taskHistoryItems(): TaskHistoryItem[] {
      const taskHistoryItems: TaskHistoryItem[] = [];
      self.taskHistory.forEach((task) =>
        taskHistoryItems.push({
          id: task.id,
          taskStatus: {
            id: task.taskStatus,
          },
          taskType: {
            label: Type[task.taskType],
          },
          data: {
            volume:
              task.volume ??
              (task.taskType === 0 || task.taskType === 2 || task.taskType === 3
                ? "deleted"
                : null),
            model: task.model ?? (task.taskType === 1 ? "deleted" : null),
            checkpoint:
              task.checkpoint ?? (task.taskType === 2 ? "deleted" : null),
          },
          enqueuedTime: {
            date: task.enqueuedTime,
          },
          startTime: {
            date: task.enqueuedTime,
          },
          endTime: {
            date: task.enqueuedTime,
          },
          log: {
            path: task.logFile ?? undefined,
          },
        })
      );
      taskHistoryItems.sort((a, b) => {
        return b.enqueuedTime.date.getTime() - a.enqueuedTime.date.getTime();
      });

      return taskHistoryItems;
    },
    cpuTaskQueueItems(): TaskQueueItem[] {
      return parseTaskQueueArray(self.cpuTaskQueue);
    },
    gpuTaskQueueItems(): TaskQueueItem[] {
      return parseTaskQueueArray(self.gpuTaskQueue);
    },
    get pageSkip() {
      return self.pageNumber * self.pageSize;
    },
    get maxPageNumber() {
      return Math.ceil(self.taskHistoryLenght / self.pageSize);
    },
  }))

  .actions((self) => ({
    createTaskHistory(task: TaskHistorySnapshotIn) {
      return TaskHistory.create({
        ...task,
        enqueuedTime: new Date(task.enqueuedTime),
        startTime: task.startTime ? new Date(task.startTime) : null,
        endTime: task.endTime ? new Date(task.endTime) : null,
      });
    },
    createTaskQueueItem(task: TaskQueueElementSnapshotIn) {
      return TaskQueueElement.create({
        ...task,
        enqueuedTime: new Date(task.enqueuedTime),
        startTime: task.startTime ? new Date(task.startTime) : null,
      });
    },
    setTaskHistory(taskQueue: TaskHistorySnapshotIn[]) {
      self.taskHistory.clear();
      taskQueue.forEach((task) => {
        self.taskHistory.put(this.createTaskHistory(task));
      });
    },
    appendTaskHistory(task: TaskHistorySnapshotIn) {
      self.taskHistory.put(this.createTaskHistory(task));
    },
    setCPUTaskQueue(taskQueue: TaskQueueElementSnapshotIn[]) {
      self.cpuTaskQueue.replace(
        taskQueue.map((task) => this.createTaskQueueItem(task))
      );
    },
    setGPUTaskQueue(taskQueue: TaskQueueElementSnapshotIn[]) {
      self.gpuTaskQueue.replace(
        taskQueue.map((task) => this.createTaskQueueItem(task))
      );
    },
  }))
  .actions((self) => ({
    fetchStatus: flow(function* fetchStatus() {
      self.activeRequests += 1;
      try {
        const currentPageNumber = self.pageNumber;
        const contents = (yield getStatus(
          currentPageNumber,
          self.pageSize
        )) as z.infer<typeof statusSchema>;
        // Check if the model is still alive after async call
        if (!isAlive(self)) {
          return;
        }
        // This checks if the page that we are currently fetching is the same as the page that we want to display.
        // This is needed since we can fetch 2 pages at the same time.
        if (self.pageNumber !== currentPageNumber) {
          return;
        }
        self.setTaskHistory(contents.taskHistory.values);
        self.setCPUTaskQueue(contents.cpuTaskQueue);
        self.setGPUTaskQueue(contents.gpuTaskQueue);
        self.freeGpus = contents.gpuStatus.freeGpus;
        self.totalGpus = contents.gpuStatus.totalGpus;
        self.taskHistoryLenght = contents.taskHistory.lenght;
      } catch (error) {
        console.error("Error:", error);
      } finally {
        self.activeRequests -= 1;
      }
    }),
    fetchGpuStatus: flow(function* () {
      try {
        console.log("Fetching GPU status...");
        const contents = (yield getGpuStatus()) as z.infer<
          typeof gpuStatusSchema
        >;
        if (!isAlive(self)) {
          return;
        }
        self.freeGpus = contents.freeGpus;
        self.totalGpus = contents.totalGpus;
      } catch (error) {
        console.error("Error:", error);
      }
    }),
  }))
  .actions((self) => ({
    setPageNumber: flow(function* setPageNumber(page: number) {
      self.pageNumber = page;
      if (self.pageNumber <= 0) {
        self.pageNumber = 1;
      }

      if (self.maxPageNumber < self.pageNumber) {
        self.pageNumber = self.maxPageNumber;
      }
      yield self.fetchStatus();
      if (!isAlive(self)) {
        return;
      }
    }),
  }));

export interface StatusInstance extends Instance<typeof Status> {}
export interface StatusSnapshotIn extends SnapshotIn<typeof Status> {}
