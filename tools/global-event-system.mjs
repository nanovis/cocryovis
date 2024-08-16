import {EventEmitter} from "node:events";

export const projectDeletedEvent = "projectDeleted";
export const volumeCreatedEvent = "volumeCreated";
export const volumeDeletedEvent = "volumeDeleted";
export const volumeDataDeletedEvent = "volumeDataDeleted";
export const modelCreatedEvent = "modelCreated";
export const modelDeletedEvent = "modelDeleted";
export const checkpointCreatedEvent = "checkpointCreated";
export const checkpointDeletedEvent = "checkpointDeleted";
export const resultDeletedEvent = "resultDeleted";

class GlobalEventEmitter extends EventEmitter {

    listeners = new Set();

    constructor() {
        super();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new this();
        }
        return this.instance;
    }
}

const globalEventEmitter = GlobalEventEmitter.getInstance();

export default globalEventEmitter;
