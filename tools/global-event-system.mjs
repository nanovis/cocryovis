import {EventEmitter} from "node:events";

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
