import {JSONFileSyncPreset, JSONFileSync} from "lowdb/node";
import {readFileSync} from "fs";

class LowdbManager {
    db;

    constructor() {
        const configFull = JSON.parse(readFileSync('./config.json', 'utf8'));
        const config = configFull.db.lowdb;

        const defaultData = new JSONFileSync(config.defaultPath)
        this.db = JSONFileSyncPreset(config.path, defaultData.read())
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new LowdbManager();
        }
        return this.instance;
    }
}



const lowdbConnection = LowdbManager.getInstance();

export default lowdbConnection;
