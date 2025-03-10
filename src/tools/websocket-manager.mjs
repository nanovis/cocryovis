// @ts-check

import WebSocket, { WebSocketServer } from "ws";
import { sanitize } from "../middleware/sanitizer.mjs";

/**
 * Enum websocket broadcast actions.
 * @readonly
 * @enum {string}
 */
export const ActionTypes = Object.freeze({
    InsertPseudoVolumes: "InsertPseudoVolumes",
    InsertResult: "InsertResult",
    InsertCheckpoint: "InsertCheckpoint",
    AddRawData: "AddRawData",
    InsertTaskHistory: "InsertTaskHistory",

    CPUQueueUpdated: "CPUQueueUpdated",
    GPUQueueUpdated: "GPUQueueUpdated",
});

// TODO: this sort of behaves like a singleton which is not ideal, should be rewritten.
export default class WebSocketManager {
    /** @type {WebSocketInstance?} */
    static #webSocketInstance = null;

    /**
     * @param {import("http").Server} expressServer
     * @param {import("express").RequestHandler} sessionParser
     */
    static initializeWebSocketInstance(expressServer, sessionParser) {
        WebSocketManager.#webSocketInstance?.closeServer();

        WebSocketManager.#webSocketInstance = new WebSocketInstance(
            expressServer,
            sessionParser
        );
        return WebSocketManager.#webSocketInstance;
    }

    static get webSocketInstance() {
        return WebSocketManager.#webSocketInstance;
    }

    /**
     * @param {Number[]} userIds
     * @param {String[]} ignoreSessionIds
     * @param {string | number | readonly any[] | ArrayBuffer | SharedArrayBuffer | Uint8Array | Buffer<ArrayBufferLike> | DataView | ArrayBufferView | readonly number[] | { valueOf(): ArrayBuffer; } | { valueOf(): SharedArrayBuffer; } | { valueOf(): Uint8Array; } | { valueOf(): readonly number[]; } | { valueOf(): string; } | { [Symbol.toPrimitive](hint: string): string; }} message
     */
    static broadcastMessage(userIds, ignoreSessionIds, message) {
        WebSocketManager.#webSocketInstance?.broadcastMessage(
            userIds,
            ignoreSessionIds,
            message
        );
    }

    /**
     * @param {Number[]} userIds
     * @param {String[]} ignoreSessionIds
     * @param {String} actionType
     * @param {Object} actionContent
     */
    static broadcastAction(
        userIds,
        ignoreSessionIds,
        actionType,
        actionContent
    ) {
        WebSocketManager.#webSocketInstance?.broadcastMessage(
            userIds,
            ignoreSessionIds,
            JSON.stringify(
                sanitize({
                    actionType: actionType,
                    actionContent: actionContent,
                })
            )
        );
    }
}

export class WebSocketInstance {
    // TODO: Use some sort of database.
    /** @type {Map<Number, Map<String, WebSocket>>} */
    #connections = new Map();

    /**
     * @param {import("http").Server} expressServer
     * @param {import("express").RequestHandler} sessionParser
     */
    constructor(expressServer, sessionParser) {
        /** @type {WebSocketServer} */
        this.websocketServer = new WebSocketServer({
            noServer: true,
            path: "/ws",
        });
        this.sessionParser = sessionParser;

        expressServer.on("upgrade", this.#onUpgrade.bind(this));

        this.websocketServer.on("connection", this.#onConnection.bind(this));
    }

    /**
     * @param {any} err
     */
    #onSocketError(err) {
        console.error(err);
    }

    /**
     * @param {import("express").Request} req
     * @param {import("stream").Duplex} socket
     * @param {Buffer} head
     */
    #onUpgrade(req, socket, head) {
        socket.on("error", this.#onSocketError);

        // @ts-ignore
        this.sessionParser(req, {}, () => {
            if (!req.session || !req.session.user) {
                socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
                socket.destroy();
                return;
            }

            socket.removeListener("error", this.#onSocketError);

            this.websocketServer.handleUpgrade(
                req,
                socket,
                head,

                (/** @type {WebSocket} */ ws) => {
                    this.websocketServer.emit("connection", ws, req);
                }
            );
        });
    }

    /**
     * @param {WebSocket} ws
     * @param {import("express").Request} req
     */
    #onConnection(ws, req) {
        if (!req.session || !req.session.user) {
            ws.close();
            return;
        }

        console.log(
            "WebSocket connection established for user:",
            req.session.user.username
        );

        this.#registerUser(req.session.user.id, req.session.id, ws);

        ws.on("message", (message) => {
            console.log(
                `Received message from ${req.session.user.username}:`,
                message
            );
        });

        ws.on("close", () => this.#onConnectionClosed(req));
    }

    #onConnectionClosed(req) {
        this.#unregisterUser(req.session.user.id, req.session.id);
        console.log("Connection closed");
    }

    closeServer() {
        this.websocketServer.close();
    }

    /**
     * @param {Number[]} userIds
     * @param {String[]} ignoreSessionIds
     * @param {string | number | readonly any[] | ArrayBuffer | SharedArrayBuffer | Uint8Array | Buffer<ArrayBufferLike> | DataView | ArrayBufferView | readonly number[] | { valueOf(): ArrayBuffer; } | { valueOf(): SharedArrayBuffer; } | { valueOf(): Uint8Array; } | { valueOf(): readonly number[]; } | { valueOf(): string; } | { [Symbol.toPrimitive](hint: string): string; }} message
     */
    broadcastMessage(userIds, ignoreSessionIds, message) {
        try {
            for (const [userId, userEntry] of this.#connections) {
                if (userIds.length > 0 && !userIds.includes(userId)) {
                    continue;
                }
                for (const [sessionId, websocket] of userEntry) {
                    if (ignoreSessionIds.includes(sessionId)) {
                        continue;
                    }
                    websocket.send(message);
                }
            }
        } catch (error) {
            console.error("Broadcast error: ", error);
        }
    }

    /**
     * @param {Number} userId
     * @param {String} sessionId
     * @param {WebSocket} websocket
     */
    #registerUser(userId, sessionId, websocket) {
        let userEntry = this.#connections.get(userId);
        if (!userEntry) {
            userEntry = new Map();
            this.#connections.set(userId, userEntry);
        }
        userEntry.set(sessionId, websocket);
    }

    /**
     * @param {Number} userId
     * @param {String} sessionId
     */
    #unregisterUser(userId, sessionId) {
        this.#connections.clear();
        let userEntry = this.#connections.get(userId);
        userEntry?.delete(sessionId);
    }
}
