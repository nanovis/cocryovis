import { Request } from "express";
import { Session } from "express-session";

declare global {
    type UnauthenticatedRequest = Request & {
        files: import("express-fileupload").FileArray;
    };

    type AuthenticatedRequest = UnauthenticatedRequest & {
        session: Session & { user?: import("./models/user.mjs").PublicUser };
    };
}
