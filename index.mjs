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
import https from "https";
import TaskHistory from "./src/models/task-history.mjs";
import { responseSanitizer } from "./src/middleware/sanitizer.mjs";

const startServer = async () => {
    const host = argv[3] ?? process.env.HOST ?? "localhost";
    const useHttps = argv[4]
        ? argv[4] === "true"
        : process.env.HTTPS === "true";

    const port =
        Number(argv[2]) || Number(process.env.PORT) || (useHttps ? 443 : 8080);

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
        app.use(
            helmet({
                contentSecurityPolicy: {
                    directives: {
                        scriptSrc: ["'self'", "'unsafe-eval'"],
                    },
                },
                originAgentCluster: false,
                crossOriginOpenerPolicy: false,
            })
        );
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

    let server = null;

    if (useHttps) {
        console.log("Initializing https server");

        let keyContent = null;
        if (process.env.SSL_KEY_CONTENT) {
            keyContent = Buffer.from(
                process.env.SSL_KEY_CONTENT,
                "base64"
            ).toString("utf8");
        } else if (process.env.SSL_KEY_PATH) {
            keyContent = fileSystem.readFileSync(process.env.SSL_KEY_PATH);
        }

        let certContent = null;
        if (process.env.SSL_CRT_CONTENT) {
            certContent = Buffer.from(
                process.env.SSL_CRT_CONTENT,
                "base64"
            ).toString("utf8");
        } else if (process.env.SSL_CRT_PATH) {
            certContent = fileSystem.readFileSync(process.env.SSL_CRT_PATH);
        }

        if (!keyContent || !certContent) {
            console.error(
                "No SSL key or certificate provided, exiting with error!"
            );
            process.exit(1);
        }

        server = https.createServer(
            {
                key: keyContent,
                cert: certContent,
            },
            app
        );
    } else {
        console.log("Initializing http server");
        server = http.createServer(app);
    }
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

    server.listen(port, host, () => {
        console.log("listening on " + host + ":" + port);
    });
};

startServer();
