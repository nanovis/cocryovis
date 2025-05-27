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
import { checkCookieAge } from "./src/middleware/restrict.mjs";
import Utils from "./src/tools/utils.mjs";

const SqliteStore = sqlite3SessionStore(session);

const startServer = async () => {
    const host =
        Utils.findArgument(argv, "--host") ?? process.env.HOST ?? "localhost";
    const useHttps =
        Utils.hasArgument(argv, "--https") ?? process.env.HTTPS === "true";

    const port =
        Number(Utils.findArgument(argv, "--port")) ||
        Number(process.env.PORT) ||
        (useHttps ? 443 : 8080);

    const demoProjectIndex =
        Number(Utils.findArgument(argv, "--demoProject")) ||
        appConfig.demoProjectIndex;
    appConfig.demoProjectIndex = demoProjectIndex;

    const seassionsPath = process.env.SESSIONS_PATH || "./database/db.sessions";

    const app = express();

    const allowedOrigins = [
        "http://localhost:3000",
        "https://files.cryoetdataportal.cziscience.com",
    ];

    const corsOptions = {
        origin: allowedOrigins,
        credentials: true,
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Content-Disposition",
            "Origin",
            "X-Requested-With",
        ],
        exposedHeaders: ["Content-Disposition"],
        methods: ["GET", "POST", "PUT", "DELETE"],
    };

    app.use(cors(corsOptions));

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


    const sessionsDir = path.dirname(seassionsPath);
    if (!fileSystem.existsSync(sessionsDir)) {
        fileSystem.mkdirSync(sessionsDir, { recursive: true, mode: 0o775 });
    }

    const sessionsDB = new Database(seassionsPath);
    sessionsDB.pragma("journal_mode = WAL");

    const sess = {
        name: appConfig.cookieName,
        store: new SqliteStore({
            client: sessionsDB,
            expired: {
                clear: true,
                intervalMs: 10 * 60 * 1000, // 10 minutes
            },
        }),
        resave: false,
        saveUninitialized: false,
        secret: process.env.SESSION_SECRET,
        rolling: true,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: appConfig.idleSessionExpirationMin * 60 * 1000,
            sameSite: "strict",
        },
    };

    // @ts-ignore
    const sessionParser = session(sess);

    if (app.get("env") === "production") {
        app.set("trust proxy", 1);
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

    app.use(checkCookieAge);

    // API
    app.use("/api", projectsApi);

    const clientPath = path.join("client", "build");
    console.log("Client path: ", clientPath);

    if (fileSystem.existsSync(clientPath)) {
        app.use("/", express.static(clientPath));
        app.use("/demo/", express.static(clientPath));
        app.use("/project/:id", express.static(clientPath));
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
    if (appConfig.cleanTempOnStartup) {
        await fileSystem.promises.rm(appConfig.tempPath, {
            recursive: true,
            force: true,
        });
    }

    server.listen(port, host, () => {
        console.log("listening on " + host + ":" + port);
    });
};

startServer();
