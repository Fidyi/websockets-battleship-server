import { httpServer } from "./src/http_server/index.js";

const HTTP_PORT = 8181;
const WS_PORT = 8080;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

console.log(`Starting WebSocket server on port ${WS_PORT}`);
startWebSocketServer(WS_PORT);