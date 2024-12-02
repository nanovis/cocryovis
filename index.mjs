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
import { projectsApi } from "./src/routes/api/projects.mjs";
import bodyParser from "body-parser";
import { argv } from "process";
import cors from "cors";
import fileUpload from "express-fileupload";
import Database from "better-sqlite3";
import sqlite3SessionStore from "better-sqlite3-session-store";
import helmet from "helmet";
import appConfig from "./src/tools/config.mjs";
import { logErrors, clientErrorHandler } from "./src/tools/error-handler.mjs";
import WebSocketManager from "./src/tools/websocket-manager.mjs";
import http from "http";
import TaskHistory from "./src/models/task-history.mjs";
import { responseSanitizer } from "./src/middleware/sanitizer.mjs";

const startServer = async () => {
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
        res.header(
            "Access-Control-Allow-Methods",
            "GET,PUT,POST,DELETE,OPTIONS"
        );
        res.header(
            "Access-Control-Allow-Headers",
            "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
        );
        next();
    });

    // config
    app.set("view engine", "ejs");
    app.set("views", [
        path.join(".", "views"),
        path.join(".", "views", "project"),
    ]);

    // middleware
    app.use(express.urlencoded({ extended: true }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(
        fileUpload({
            createParentPath: true,
            useTempFiles: true,
            tempFileDir: path.join(appConfig.tempPath, "upload"),
        })
    );

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
    // @ts-ignore
    const sessionParser = session(sess);

    if (app.get("env") === "production") {
        // app.set('trust proxy', 1)
        sess.cookie.secure = true;
        sess.cookie.HttpOnly = true;
        app.use(helmet());
    }

    app.use(sessionParser);

    app.use(responseSanitizer);

    // API
    app.use("/api", projectsApi);

    const clientPath = path.join("client", "build");

    if (fileSystem.existsSync(clientPath)) {
        app.use(express.static(clientPath));
        app.get("/", function (req, res) {
            res.sendFile(path.join(clientPath, "index.html"));
        });
    } else {
        console.warn("No client build found, serving api only!");
    }

    app.use("/logs", express.static("logs", { index: false }));

    const server = http.createServer(app);
    // Websockets
    WebSocketManager.initializeWebSocketInstance(server, sessionParser);

    // 404 Error
    app.use(function (req, res) {
        res.status(404).json({
            name: "Bad Url",
            message: "Sorry, this page does not exist.",
        });
    });

    app.use(logErrors);
    app.use(clientErrorHandler);

    await TaskHistory.clearOngoing();

    server.listen(port, () => {
        console.log("listening on port " + port);
    });
};

startServer();
