const games: { gameId: number, players: any[], currentTurn: number, start: boolean }[] = [];
let gameIdCounter = 1;

export function addShipsToGame(gameId: number, indexPlayer: number, ships: any[]) {
    const game = getGameById(gameId);
    if (!game) throw new Error('Game not found');

    const player = game.players[indexPlayer];
    if (!player) throw new Error('Player not found in game');

    player.ships = ships;
    player.shipsAdded = true;
}

export function startGame(gameId: number) {
    const game = getGameById(gameId);
    if (!game) throw new Error('Game not found');
    if (game.players.length !== 2) throw new Error('Not enough players');

    if (game.players.every(player => player.shipsAdded)) {
        game.start = true;
        game.currentTurn = Math.floor(Math.random() * 2);
    } else {
        throw new Error('Not all players have added their ships');
    }
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

    const result = processAttack(game, indexPlayer, { x, y });

    game.players.forEach(player => {
        safeSend(player.ws, {
            type: 'attack',
            data: JSON.stringify({
                position: { x, y },
                currentPlayer: game.currentTurn,
                status: result.status,
            }),
            id: 0,
        });
    });

    if (result.status === 'miss') {
        game.currentTurn = game.currentTurn === 0 ? 1 : 0;
    }
}

export function finishGame(gameId: number, winPlayerIndex: number) {
    const game = getGameById(gameId);
    if (game) {
        game.players.forEach(player => {
            safeSend(player.ws, {
                type: 'finish',
                data: JSON.stringify({ winPlayer: winPlayerIndex }),
                id: 0,
            });
        });
        console.log(`Game ${gameId} finished. Winner: Player ${winPlayerIndex}`);
    }
}

export function getGameById(gameId: number) {
    return games.find(game => game.gameId === gameId);
}

function processAttack(game: any, indexPlayer: number, { x, y }: { x: number, y: number }) {
    return { status: 'miss' };
}

function safeSend(ws: WebSocket, message: any) {
    try {
        const jsonMessage = typeof message === 'string' ? message : JSON.stringify(message);
        ws.send(jsonMessage);
    } catch (error) {
        console.error('Error serializing message:', message, error);
    }
}
