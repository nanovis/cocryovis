import { readFileSync } from "fs";

class Config {
  /**
   * @type {AppConfig}
   */
  config;

  constructor() {
    /**
     * @type {AppConfig}
     */
    this.config = JSON.parse(readFileSync("./config.json", "utf8"));
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }
}

const appConfig = Config.getInstance().config;

export default appConfig;
