import { WebSocket } from 'ws';

export function safeSend(ws: WebSocket, message: any) {
    try {
        if (typeof message !== 'string') {
            message = JSON.stringify(message);
        }
        ws.send(message);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}
