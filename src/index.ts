import { httpServer } from './http_server/index';
import { createWebSocketServer } from './websocket_server/index';
import * as dotenv from 'dotenv';

dotenv.config();

const HTTP_PORT = process.env.HTTP_PORT || 8181;
const WS_PORT = process.env.WS_PORT || 3000;

httpServer.listen(HTTP_PORT, () => {
    console.log(`Static HTTP server started on port ${HTTP_PORT}`);
});

createWebSocketServer(WS_PORT);