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
import { actions } from "./routes/api/actions.mjs";
import { projectsApi } from "./routes/api/projects.mjs";
import bodyParser from "body-parser";
import { argv } from "process";
import cors from "cors";
import fileUpload from 'express-fileupload';
import { restrict } from "./middleware/restrict.mjs";
import UserController from "./controllers/user-controller.mjs";
import Database from "better-sqlite3";
import sqlite3SessionStore from "better-sqlite3-session-store";
import helmet from "helmet";
import appConfig from "./tools/config.mjs";

const port = argv[2] || 8080;
const app = express(express.json());

// config
app.set("view engine", "ejs");
app.set("views", [path.join(".", "views"), path.join(".", "views", "project")]);

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
projectsApi.use(fileUpload({ createParentPath: true }));
app.use(cors());

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

app.use(session(sess));

// Server actions
app.use("/api", projectsApi);
app.use("/api/actions", actions);

app.use(express.static("web", { index: false }));
app.use(express.static("data", { index: false }));
app.use("/logs", express.static("logs", { index: false }));

// Handling root route
app.get("/", restrict, function (req, res) {
    res.redirect("/auth");
});

// Handling auth route
app.get("/auth", restrict, function (req, res) {
    // res.send('Wahoo! restricted area, click to <a href="/logout">logout</a>');
    res.render("actions");
});

// Handling logout route
app.get("/logout", UserController.logout);

// Handling login route
app.get("/login", function (req, res) {
    res.render("login", { message: "" });
});

app.post("/login", UserController.login);

app.get("/test", function (req, res) {
    console.log("Test request initiated...");
    res.send({ message: "This is a bit longer test message ..." });
});

// 404 Error
app.use(function (req, res) {
    res.status(404).send({ error: "Sorry, this page does not exist." });
});

// Running server
app.listen(port, () => {
    console.log("listening on port " + port);
});
