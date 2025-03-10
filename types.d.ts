import { Session } from "express-session";

declare module "express-session" {
    interface SessionData {
        user?: import("./models/user.mjs").PublicUser;
    }
}
