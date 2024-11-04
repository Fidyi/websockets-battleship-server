import { WebSocket } from 'ws';

import { safeSend } from '../utils/safeSend';
import { getWinnersData } from './playerController';
import { incrementWin } from '../db/inMemoryDB';
import { Player } from '../models/player';

interface Ship {
    position: {
        x: number;
        y: number;
    };
    direction: boolean;
    length: number;
    type: "small" | "medium" | "large" | "huge";
}

interface PlayerInGame {
    player: Player;
    ws: WebSocket;
    ships: Ship[];
    shipsGrid: number[][];
    index: number;
}

interface Game {
    gameId: number;
    players: PlayerInGame[];
    currentTurn: number;
    start: boolean;
}

const games: Game[] = [];
let gameIdCounter = 1;

export function createGame(room: any): number {
    const gameId = gameIdCounter++;
    const game: Game = {
        gameId,
        players: room.players.map((p: any, index: number) => ({
            player: p.player,
            ws: p.ws,
            ships: [],
            shipsGrid: Array.from({ length: 10 }, () => Array(10).fill(0)),
            index,
        })),
        currentTurn: Math.floor(Math.random() * 2),
        start: false,
    };
    games.push(game);
    console.log(`Game ${gameId} created with players: ${room.players.map(p => p.player.name).join(', ')}`);
    return gameId;
}

export function getGameById(gameId: number): Game | undefined {
    console.log(`getGameById called with gameId: ${gameId} (type: ${typeof gameId})`);
    return games.find(game => game.gameId === gameId);
}


export function addShipsToGame(gameId: number, indexPlayer: number, ships: Ship[]) {
    const game = getGameById(gameId);
    if (!game) throw new Error('Game not found.');

    const player = game.players.find(p => p.index === indexPlayer);
    if (!player) throw new Error('Player not found in game.');

    console.log(`Player ${indexPlayer} before adding ships: ships.length=${player.ships.length}`);

    player.ships = ships;
    ships.forEach(ship => {
        const { x, y } = ship.position;
        console.log(`Processing ship: position=(${x}, ${y}), direction=${ship.direction}, length=${ship.length}`);
        for (let i = 0; i < ship.length; i++) {
            const posX = ship.direction ? x : x + i;
            const posY = ship.direction ? y + i : y;
            console.log(`Placing ship part at (${posX}, ${posY})`);
            if (posX < 0 || posX >= 10 || posY < 0 || posY >= 10) {
                throw new Error('Ship out of bounds.');
            }
            if (player.shipsGrid[posY][posX] === 1) {
                throw new Error('Ships overlap.');
            }
            player.shipsGrid[posY][posX] = 1;
        }
    });

    console.log(`Player ${indexPlayer} after adding ships: ships.length=${player.ships.length}`);
}


export function handleAddShips(ws: WebSocket, command: any) {
    let data;
    try {
        data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
    } catch (error) {
    }

    const gameId = Number(data.gameId);
    const indexPlayer = Number(data.indexPlayer);
    const ships = data.ships;

    console.log(`Received add_ships for gameId: ${gameId} (type: ${typeof gameId}), indexPlayer: ${indexPlayer} (type: ${typeof indexPlayer})`);

    try {
        addShipsToGame(gameId, indexPlayer, ships);
        safeSend(ws, {
            type: 'add_ships',
            data: JSON.stringify({
                error: false,
                message: 'Ships added successfully.',
            }),
            id: command.id,
        });

        console.log(`Player ${indexPlayer} added ships for game ${gameId}`);

        const game = getGameById(gameId);
        if (game) {
            console.log(`After adding ships: gameId=${gameId}, players' ships lengths: ${game.players.map(p => p.ships.length).join(', ')}`);
            if (game.players.every(player => player.ships.length > 0)) {
                console.log(`All players have added ships for game ${gameId}. Starting game...`);
                startGame(gameId);
            }
        } else {
            console.log(`Game not found with gameId: ${gameId}`);
        }
    } catch (error: any) {
        console.error(`Error in handleAddShips: ${error.message}`);
    }
}



export function startGame(gameId: number) {
    const game = getGameById(gameId);
    console.log(`startGame called with gameId: ${gameId} (type: ${typeof gameId})`);
    if (!game) throw new Error('Game not found.');
    console.log(`Game ${gameId} is starting...`);
    game.start = true;
    game.players.forEach(player => {
        safeSend(player.ws, {
            type: 'start_game',
            data: JSON.stringify({
                ships: player.ships,
                currentPlayerIndex: game.currentTurn,
            }),
            id: 0,
        });
    });

    sendTurnInfo(game);
}

export function sendTurnInfo(game: Game) {
    const currentPlayer = game.players[game.currentTurn];
    game.players.forEach(player => {
        safeSend(player.ws, {
            type: 'turn',
            data: JSON.stringify({
                currentPlayer: currentPlayer.index,
            }),
            id: 0,
        });
    });
}

export function handleAttack(ws: WebSocket, command: any) {
    let data;
    try {
        data = typeof command.data === 'string' ? JSON.parse(command.data) : command.data;
    } catch (error) {
        safeSend(ws, {
            type: 'attack',
            data: JSON.stringify({
                error: true,
                errorText: 'Invalid data format. Expected JSON object.',
            }),
            id: command.id,
        });
        return;
    }

    const { gameId, x, y, indexPlayer } = data;
    const game = getGameById(gameId);
    if (!game) {
        safeSend(ws, {
            type: 'attack',
            data: JSON.stringify({
                error: true,
                errorText: 'Game not found.',
            }),
            id: command.id,
        });
        return;
    }

    if (game.players[game.currentTurn].index !== indexPlayer) {
        safeSend(ws, {
            type: 'attack',
            data: JSON.stringify({
                error: true,
                errorText: 'Not your turn.',
            }),
            id: command.id,
        });
        return;
    }

    const opponent = game.players.find(p => p.index !== indexPlayer);
    if (!opponent) {
        safeSend(ws, {
            type: 'attack',
            data: JSON.stringify({
                error: 'Opponent not found.',
            }),
            id: command.id,
        });
        return;
    }

    let status = 'miss';
    if (opponent.shipsGrid[y][x] === 1) {
        opponent.shipsGrid[y][x] = 2; // 
        status = 'shot';
        const shipDestroyed = checkShipDestroyed(opponent, x, y);
        if (shipDestroyed) {
            status = 'killed';
        }
    } else if (opponent.shipsGrid[y][x] === 0) {
        opponent.shipsGrid[y][x] = 3; // miss
    }

    game.players.forEach(player => {
        safeSend(player.ws, {
            type: 'attack',
            data: JSON.stringify({
                position: { x, y },
                currentPlayer: indexPlayer,
                status,
            }),
            id: 0,
        });
    });

    if (status === 'miss') {
        game.currentTurn = (game.currentTurn + 1) % game.players.length;
        sendTurnInfo(game);
    } else if (status === 'shot' || status === 'killed') {
        if (status === 'killed') {
            markSurroundingCells(opponent, x, y);
        }
        if (checkWin(opponent)) {
            finishGame(game, indexPlayer);
            return;
        }
    }
}

function checkShipDestroyed(player: PlayerInGame, x: number, y: number): boolean {
    return !player.shipsGrid.flat().includes(1);
}

function markSurroundingCells(player: PlayerInGame, x: number, y: number) {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],          [0, 1],
        [1, -1], [1, 0], [1, 1],
    ];

    directions.forEach(([dx, dy]) => {
        const newX = x + dx;
        const newY = y + dy;
        if (newX >= 0 && newX < 10 && newY >= 0 && newY < 10) {
            if (player.shipsGrid[newY][newX] === 0) {
                player.shipsGrid[newY][newX] = 3; // miss
            }
        }
    });
}

function checkWin(player: PlayerInGame): boolean {
    return !player.shipsGrid.flat().includes(1);
}

export function finishGame(game: Game, winPlayerIndex: number) {
    const winner = game.players.find(p => p.index === winPlayerIndex);
    if (winner) {
        incrementWin(winner.player.name);
    }

    game.players.forEach(player => {
        safeSend(player.ws, {
            type: 'finish',
            data: JSON.stringify({
                winPlayer: winPlayerIndex,
            }),
            id: 0,
        });
    });
    const winnersData = getWinnersData();
    game.players.forEach(player => {
        safeSend(player.ws, {
            type: 'update_winners',
            data: JSON.stringify(winnersData),
            id: 0,
        });
    });

    const index = games.findIndex(g => g.gameId === game.gameId);
    if (index !== -1) {
        games.splice(index, 1);
    }

    console.log(`Game ${game.gameId} finished. Winner: Player ${winPlayerIndex}`);
}
