import { WebSocket, WebSocketServer } from 'ws';
import { registerPlayer } from '../controllers/playerController';
import { createRoom, getAvailableRooms, addUserToRoom, getRoomById } from '../controllers/gameRoomController';
import { addShipsToGame, handleAttack, startGame, finishGame, getGameById } from '../controllers/gameController';

let gameIdCounter = 1;
const games: { gameId: number, players: any[], currentTurn: number, start: boolean }[] = [];

export function createWebSocketServer(port: number) {
    const wss = new WebSocketServer({ port });

    console.log(`WebSocket server started on port ${port}`);

    wss.on('connection', (ws) => {
        console.log('New client connected');

        ws.on('message', (message: string) => {
            try {
                const command = JSON.parse(message);
                console.log('Received:', command);

                switch (command.type) {
                    case 'reg':
                        handlePlayerRegistration(ws, command);
                        break;
                    case 'create_room':
                        handleCreateRoom(ws);
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
                    default:
                        ws.send(JSON.stringify({ error: 'Unknown command type' }));
                }
            } catch (error) {
                console.error('Error handling message:', error);
                ws.send(JSON.stringify({ error: 'Invalid command format' }));
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
}

function handlePlayerRegistration(ws: WebSocket, command: any) {
    try {
        const data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
        const player = registerPlayer(data.name, data.password);

        safeSend(ws, {
            type: 'reg',
            data: {
                name: player.name,
                index: player.index,
                error: false,
                errorText: '',
            },
            id: command.id,
        });
    } catch (error) {
        safeSend(ws, {
            type: 'reg',
            data: {
                error: true,
                errorText: error.message,
            },
            id: command.id,
        });
    }
}

function handleCreateRoom(ws: WebSocket) {
    const roomId = createRoom();
    const availableRooms = getAvailableRooms();
    const formattedRooms = availableRooms.map((room) => ({
        roomId: room.roomId,
        roomUsers: room.players.map((player) => ({
            name: player.name,
            index: player.index,
        })),
    }));

    safeSend(ws, {
        type: 'update_room',
        data: formattedRooms,
        id: 0,
    });
    console.log(`Room ${roomId} created`);
}

function handleAddUserToRoom(ws: WebSocket, command: any) {
    let data;

    try {
        data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
    } catch (error) {
        safeSend(ws, {
            type: 'add_user_to_room',
            data: {
                error: true,
                errorText: 'Invalid data format. Expected JSON object.',
            },
            id: command.id,
        });
        return;
    }

    const { indexRoom, playerName } = data;

    try {
        addUserToRoom(indexRoom, playerName, ws);
        const room = getRoomById(indexRoom);

        if (room.players.length === 2) {
            const gameId = createGame(room.players);
            room.players.forEach((player, index) => {
                if (player.ws) {
                    safeSend(player.ws, {
                        type: 'create_game',
                        data: {
                            idGame: gameId,
                            idPlayer: index,
                        },
                        id: 0,
                    });
                }
            });
            console.log(`Game ${gameId} created with players: ${room.players.map(p => p.name).join(', ')}`);
        }

        const availableRooms = getAvailableRooms();
        const formattedRooms = availableRooms.map((room) => ({
            roomId: room.roomId,
            roomUsers: room.players.map((player) => ({
                name: player.name,
                index: player.index,
            })),
        }));

        safeSend(ws, {
            type: 'update_room',
            data: formattedRooms,
            id: 0,
        });
        console.log(`Player ${playerName} added to room ${indexRoom}`);
    } catch (error) {
        safeSend(ws, {
            type: 'add_user_to_room',
            data: {
                error: true,
                errorText: error.message,
            },
            id: command.id,
        });
    }
}


function handleAddShips(ws: WebSocket, command: any) {
    let data;

    try {
        data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
    } catch (error) {
        safeSend(ws, {
            type: 'add_ships',
            data: {
                error: true,
                errorText: 'Invalid data format. Expected JSON object.',
            },
            id: command.id,
        });
        return;
    }

    const { gameId, ships, indexPlayer } = data;

    try {
        addShipsToGame(gameId, indexPlayer, ships);

        safeSend(ws, {
            type: 'add_ships',
            data: {
                error: false,
                message: 'Ships added successfully.',
            },
            id: command.id,
        });

        console.log(`Player ${indexPlayer} added ships for game ${gameId}`);

        const game = getGameById(gameId);
        if (game && game.players.every(player => player.shipsAdded && player.ws)) {
            startGame(gameId);
            game.players.forEach(player => {
                safeSend(player.ws, {
                    type: 'start_game',
                    data: {
                        ships: player.ships,
                        currentPlayerIndex: game.currentTurn,
                    },
                    id: 0,
                });
            });
            console.log(`Game ${gameId} started`);
        }
    } catch (error) {
        safeSend(ws, {
            type: 'add_ships',
            data: {
                error: true,
                errorText: error.message,
            },
            id: command.id,
        });
    }
}


function safeSend(ws: WebSocket, message: any) {
    try {
        if (typeof message !== 'string') {
            if (typeof message.data !== 'string') {
                message.data = JSON.stringify(message.data);
            }
            message = JSON.stringify(message);
        }
        ws.send(message);
    } catch (error) {
        console.error('Error serializing message:', message, error);
    }
}

function createGame(players: any[]) {
    const gameId = gameIdCounter++;
    games.push({
        gameId,
        players: players.map((player, index) => ({
            ...player,
            shipsAdded: false,
            ships: [],
            ws: player.ws,
            index,
        })),
        currentTurn: Math.floor(Math.random() * players.length),
        start: false,
    });
    return gameId;
}
