export default class TaskQueue {
    #queue = []
    #pendingProcess = false;

    constructor() {
    }

    get size() {
        return this.#queue.length;
    }

    get hasPendingTask() {
        return this.#pendingProcess;
    }


    enqueue(action) {
        return new Promise((resolve, reject) => {
            this.#queue.push({action, resolve, reject});
            this.dequeue();
        })
    }

    async dequeue() {
        if (this._pendingProcess) return false;

        const task = this.#queue.shift()

        if (!task) return false;

        try {
            this._pendingProcess = true;

            let payload = await task.action(this);
            this._pendingProcess = false;
            task.resolve(payload);
        } catch (error) {
            this._pendingProcess = false;
            task.reject(error);
        } finally {
            this.dequeue();
        }

        return true;
    }

    clear() {
        this.#queue.length = 0; // I love javascript
    }
}