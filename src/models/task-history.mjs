// @ts-check

import DatabaseModel from "./database-model.mjs";
import prismaManager from "../tools/prisma-manager.mjs";
import WebSocketManager, { ActionTypes } from "../tools/websocket-manager.mjs";

/**
 * @typedef { import("@prisma/client").TaskHistory } TaskHistoryDB
 */

export default class TaskHistory extends DatabaseModel {
    static modelName = "taskHistory";

    static type = Object.freeze({
        LabelInference: 0,
        Training: 1,
        Inference: 2,
        Reconstruction: 3,
    });

    static status = Object.freeze({
        enqueued: 0,
        running: 1,
        finished: 2,
        failed: 3,
    });

    static get db() {
        return prismaManager.db.taskHistory;
    }

    /**
     * @param {number} id
     */
    static async getById(id) {
        const task = await super.getById(id);

        return TaskHistory.parseTaskHistory(task);
    }

    /**
     * @param {number} userId
     */
    static async getFromUser(userId) {
        const taskHistory = await this.db.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                enqueuedTime: "desc",
            },
            include: {
                volume: true,
                model: true,
                checkpoint: true,
            },
        });

        return taskHistory.map((task) => {
            return TaskHistory.parseTaskHistory(task);
        });
    }

    static async getCPUTaskQueue() {
        const taskHistory = await this.db.findMany({
            where: {
                taskType: this.type.LabelInference,
                OR: [
                    {
                        taskStatus: this.status.enqueued,
                    },
                    {
                        taskStatus: this.status.running,
                    },
                ],
            },
            include: {
                user: true,
            },
            orderBy: {
                enqueuedTime: "desc",
            },
        });

        return taskHistory.map((task) => {
            return TaskHistory.parseTaskHistory(task);
        });
    }

    static async getGPUTaskQueue() {
        const taskHistory = await this.db.findMany({
            where: {
                NOT: {
                    taskType: this.type.LabelInference,
                },
                OR: [
                    {
                        taskStatus: this.status.enqueued,
                    },
                    {
                        taskStatus: this.status.running,
                    },
                ],
            },
            include: {
                user: true,
            },
            orderBy: {
                enqueuedTime: "desc",
            },
        });

        return taskHistory.map((task) => {
            return TaskHistory.parseTaskHistory(task);
        });
    }

    /**
     * @template T
     * @param {T & {enqueuedTime: Date | null, startTime: Date | null, endTime: Date | null}} taskHistory
     */
    static parseTaskHistory(taskHistory) {
        return {
            ...taskHistory,
            enqueuedTime: taskHistory.enqueuedTime.toISOString(),
            startTime: taskHistory.startTime?.toISOString() ?? null,
            endTime: taskHistory.endTime?.toISOString() ?? null,
        };
    }

    /**
     * @param {import("@prisma/client").Prisma.TaskHistoryUncheckedCreateInput} parameters
     */
    static async create(parameters) {
        const taskHistory = await this.db.create({
            data: parameters,
            include: {
                volume: true,
                model: true,
                checkpoint: true,
            },
        });

        const parsedTaskHistory = TaskHistory.parseTaskHistory(taskHistory);
        WebSocketManager.broadcastAction(
            [parameters.userId],
            [],
            ActionTypes.InsertTaskHistory,
            parsedTaskHistory
        );

        if (
            taskHistory.taskStatus === TaskHistory.status.enqueued ||
            taskHistory.taskStatus === TaskHistory.status.running
        ) {
            TaskHistory.onQueueUpdate(taskHistory).catch(console.error);
        }

        return parsedTaskHistory;
    }

    /**
     * @param {number} id
     * @param {import("@prisma/client").Prisma.TaskHistoryUpdateInput} changes
     */
    static async update(id, changes) {
        const taskHistory = await super.update(id, changes, {
            volume: true,
            model: true,
            checkpoint: true,
        });

        const parsedTaskHistory = TaskHistory.parseTaskHistory(taskHistory);

        WebSocketManager.broadcastAction(
            [taskHistory.userId],
            [],
            ActionTypes.InsertTaskHistory,
            parsedTaskHistory
        );
        if (
            changes.taskStatus !== undefined ||
            taskHistory.taskStatus === TaskHistory.status.enqueued ||
            taskHistory.taskStatus === TaskHistory.status.running
        ) {
            TaskHistory.onQueueUpdate(taskHistory).catch(console.error);
        }

        return parsedTaskHistory;
    }

    /**
     * @param {number} id
     */
    static async del(id) {
        const taskHistory = await super.del(id);
        const parsedTaskHistory = TaskHistory.parseTaskHistory(taskHistory);

        if (
            taskHistory.taskStatus === TaskHistory.status.enqueued ||
            taskHistory.taskStatus === TaskHistory.status.running
        ) {
            TaskHistory.onQueueUpdate(taskHistory).catch(console.error);
        }

        return parsedTaskHistory;
    }

    /**
     * @param {TaskHistoryDB} taskHistory
     */
    static async onQueueUpdate(taskHistory) {
        if (taskHistory.taskType === TaskHistory.type.LabelInference) {
            await TaskHistory.onCPUQueueUpdate();
        } else {
            await TaskHistory.onGPUQueueUpdate();
        }
    }

    static async onCPUQueueUpdate() {
        const taskHistoryList = await TaskHistory.getCPUTaskQueue();
        WebSocketManager.broadcastAction(
            [],
            [],
            ActionTypes.CPUQueueUpdated,
            taskHistoryList
        );
    }

    static async onGPUQueueUpdate() {
        const taskHistoryList = await TaskHistory.getGPUTaskQueue();
        WebSocketManager.broadcastAction(
            [],
            [],
            ActionTypes.GPUQueueUpdated,
            taskHistoryList
        );
    }

    static async clearOngoing() {
        const deletionPayload = await this.db.deleteMany({
            where: {
                taskStatus: {
                    in: [this.status.enqueued, this.status.running],
                },
            },
        });
        if (deletionPayload.count > 0) {
            await TaskHistory.onCPUQueueUpdate();
            await TaskHistory.onGPUQueueUpdate();
        }
    }
}
