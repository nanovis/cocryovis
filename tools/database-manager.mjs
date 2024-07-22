import {JSONFileSyncPreset, JSONFileSync} from "lowdb/node";

class DatabaseManager {
    db;

    constructor(dbPath, dbDefaultPath) {
        const defaultData = new JSONFileSync(dbDefaultPath)
        this.db = JSONFileSyncPreset(dbPath, defaultData.read())
    }

    static getInstance(dbPath, dbDefaultPath) {
        if (!this.instance) {
            this.instance = new DatabaseManager(dbPath, dbDefaultPath);
        }
        return this.instance;
    }
}

const dbConnection = DatabaseManager.getInstance('./db.json', './default_data.json');

export default dbConnection;