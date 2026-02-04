// @ts-check

export default class TaskQueue {
  /**
   * @typedef {{action: Function, resolve: Function, reject: Function}} Task
   */

  /** @type {Task[]} */
  #queue = [];
  #pendingProcess = false;

  constructor() {}

  /**
   * @returns {number}
   */
  get size() {
    return this.#queue.length;
  }

  /**
   * @returns {boolean}
   */
  get hasPendingTask() {
    return this.#pendingProcess;
  }

  /**
   * @param {Function} action
   */
  enqueue(action) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ action, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue() {
    if (this._pendingProcess) return false;

    // Retain current task in queue so it is returned when inquiring about current tasks.
    // const task = this.#queue.shift();
    const task = this.#queue[0];

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
      this.#queue.shift();
      this.dequeue();
    }

    return true;
  }

  clear() {
    this.#queue.length = 0; // I love javascript
  }
}
