// @ts-check
/*
    VolWeb

    author: @CirilBohak
    organization: @nanovis
*/
import "dotenv/config";

import express from "express";
import path from "path";
import fileSystem from "fs";
import session from "express-session";
import { projectsApi } from "./routes/api/projects.mjs";
import bodyParser from "body-parser";
import { argv } from "process";
import cors from "cors";
import fileUpload from "express-fileupload";
import Database from "better-sqlite3";
import sqlite3SessionStore from "better-sqlite3-session-store";
import helmet from "helmet";
import appConfig from "./tools/config.mjs";
import { logErrors, clientErrorHandler } from './tools/error-handler.mjs'

const port = argv[2] || 8080;
const app = express();

app.use(
    cors({
        credentials: true,
        origin: "http://localhost:3000",
        exposedHeaders: ["Content-Disposition"],
    })
);
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
    );
    next();
});

// config
app.set("view engine", "ejs");
app.set("views", [path.join(".", "views"), path.join(".", "views", "project")]);

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(fileUpload({ createParentPath: true }));

fileSystem.mkdirSync("sessions", { recursive: true });

const sessionsDB = new Database("sessions/sessions.db");
sessionsDB.pragma("journal_mode = WAL");

const SqliteStore = sqlite3SessionStore(session);

const sess = {
    store: new SqliteStore({
        client: sessionsDB,
        expired: {
            clear: true,
            intervalMs: 12 * 60 * 60 * 1000,
        },
    }),
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET,
    rolling: true,
    cookie: {
        maxAge: appConfig.idleSessionExpirationMin * 60 * 1000,
    },
};

if (app.get("env") === "production") {
    // app.set('trust proxy', 1)
    sess.cookie.secure = true;
    sess.cookie.HttpOnly = true;
    app.use(helmet());
}

// @ts-ignore
app.use(session(sess));

// API
app.use("/api", projectsApi);

app.use(express.static("web", { index: false }));
app.use(express.static(appConfig.dataPath, { index: false }));
app.use("/logs", express.static("logs", { index: false }));

// 404 Error
app.use(function (req, res) {
    res.status(404).json({
        name: "Bad Url",
        message: "Sorry, this page does not exist.",
    });
});

app.use(logErrors);
app.use(clientErrorHandler);

// Running server
app.listen(port, () => {
    console.log("listening on port " + port);
});
