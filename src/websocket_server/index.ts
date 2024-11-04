import { WebSocket, WebSocketServer } from 'ws';
import { handleRegister, handleLogin, getWinnersData } from '../controllers/playerController';
import { createRoom, getAvailableRooms, addUserToRoom, getRoomById, getFormattedRooms } from '../controllers/gameRoomController';
import { handleAddShips, handleAttack, createGame, finishGame } from '../controllers/gameController';
import { safeSend } from '../utils/safeSend';

export function createWebSocketServer(port: number) {
    const wss = new WebSocketServer({ port });

    console.log(`WebSocket server started on port ${port}`);
    const clients: Set<WebSocket> = new Set();
    const wsToPlayer: Map<WebSocket, any> = new Map();

    wss.on('connection', (ws) => {
        console.log('New client connected');
        clients.add(ws);

        ws.on('message', (message: string) => {
            try {
                const command = JSON.parse(message);
                console.log('Received:', command);

                switch (command.type) {
                    case 'reg':
                        handlePlayerRegistration(ws, command);
                        break;
                    case 'login':
                        handlePlayerLogin(ws, command);
                        break;
                    case 'create_room':
                        handleCreateRoom(ws, command);
                        break;
                    case 'add_user_to_room':
                        handleAddUserToRoom(ws, command);
                        break;
                    case 'add_ships':
                        handleAddShips(ws, command);
                        break;
                    case 'attack':
                        handleAttack(ws, command);
                        break;
                    case 'randomAttack':
                        handleRandomAttack(ws, command);
                        break;
                    default:
                        safeSend(ws, {
                            type: 'error',
                            data: JSON.stringify({ error: 'Unknown command type' }),
                            id: command.id,
                        });
                }
            } catch (error) {
                console.error('Error handling message:', error);
                safeSend(ws, {
                    type: 'error',
                    data: JSON.stringify({ error: 'Invalid command format' }),
                    id: 0,
                });
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
            clients.delete(ws);
            wsToPlayer.delete(ws);
        });
    });

    function handlePlayerRegistration(ws: WebSocket, command: any) {
        try {
            const data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
            const player = handleRegister(data);
            wsToPlayer.set(ws, player);

            safeSend(ws, {
                type: 'reg',
                data: JSON.stringify({
                    name: player.name,
                    index: player.index,
                    error: false,
                    errorText: '',
                }),
                id: command.id,
            });
            safeSend(ws, {
                type: 'update_winners',
                data: JSON.stringify(getWinnersData()),
                id: 0,
            });
        } catch (error: any) {
            safeSend(ws, {
                type: 'reg',
                data: JSON.stringify({
                    error: true,
                    errorText: error.message,
                }),
                id: command.id,
            });
        }
    }

    function handlePlayerLogin(ws: WebSocket, command: any) {
        try {
            const data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
            const player = handleLogin(data);
            wsToPlayer.set(ws, player);

            safeSend(ws, {
                type: 'reg',
                data: JSON.stringify({
                    name: player.name,
                    index: player.index,
                    error: false,
                    errorText: '',
                }),
                id: command.id,
            });
            safeSend(ws, {
                type: 'update_winners',
                data: JSON.stringify(getWinnersData()),
                id: 0,
            });
        } catch (error: any) {
            safeSend(ws, {
                type: 'reg',
                data: JSON.stringify({
                    error: true,
                    errorText: error.message,
                }),
                id: command.id,
            });
        }
    }

    function handleCreateRoom(ws: WebSocket, command: any) {
        try {
            const player = wsToPlayer.get(ws);
            if (!player) {
                throw new Error('Player not registered or logged in.');
            }
            const room = createRoom();
            addUserToRoom(room.roomId, player, ws);
            const formattedRooms = getFormattedRooms();
            clients.forEach(client => {
                safeSend(client, {
                    type: 'update_room',
                    data: JSON.stringify(formattedRooms),
                    id: 0,
                });
            });
            safeSend(ws, {
                type: 'create_room',
                data: JSON.stringify({
                    roomId: room.roomId,
                    error: false,
                    errorText: '',
                }),
                id: command.id,
            });

            console.log(`Room ${room.roomId} created by player ${player.name}`);
        } catch (error: any) {
            safeSend(ws, {
                type: 'create_room',
                data: JSON.stringify({
                    error: true,
                    errorText: error.message,
                }),
                id: command.id,
            });
        }
    }

    function handleAddUserToRoom(ws: WebSocket, command: any) {
        try {
            const data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
            const { indexRoom } = data;
            const player = wsToPlayer.get(ws);
            if (!player) {
                throw new Error('Player not registered or logged in.');
            }
            const room = addUserToRoom(Number(indexRoom), player, ws);
            const formattedRooms = getFormattedRooms();
            clients.forEach(client => {
                safeSend(client, {
                    type: 'update_room',
                    data: JSON.stringify(formattedRooms),
                    id: 0,
                });
            });
            if (room.players.length === 2) {
                const gameId = createGame(room);
                room.players.forEach((p: any, index: number) => {
                    safeSend(p.ws, {
                        type: 'create_game',
                        data: JSON.stringify({
                            idGame: gameId,
                            idPlayer: index,
                        }),
                        id: 0,
                    });
                    console.log(`Sent 'create_game' to player ${p.player.name} for game ${gameId}`);
                });
                console.log(`Game ${gameId} created with players: ${room.players.map((p: any) => p.player.name).join(', ')}`);
            }            

            console.log(`Player ${player.name} added to room ${indexRoom}`);
        } catch (error: any) {
            safeSend(ws, {
                type: 'add_user_to_room',
                data: JSON.stringify({
                    error: true,
                    errorText: error.message,
                }),
                id: command.id,
            });
        }
    }

    function handleRandomAttack(ws: WebSocket, command: any) {
        safeSend(ws, {
            type: 'error',
            data: JSON.stringify({
                error: 'randomAttack not implemented yet.',
            }),
            id: command.id,
        });
    }
}
