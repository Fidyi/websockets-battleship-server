interface Player {
    name: string;
    password: string;
    index: number;
    wins: number;
}

const players: { [key: string]: Player } = {};
let playerIndex = 1;

export function registerPlayer(name: string, password: string): Player {
    if (players[name]) {
        throw new Error('Player already exists.');
    }

    players[name] = {
        name,
        password,
        index: playerIndex++,
        wins: 0,
    };
    return players[name];
}

export function authenticatePlayer(name: string, password: string): Player {
    const player = players[name];
    if (!player || player.password !== password) {
        throw new Error('Invalid name or password.');
    }
    return player;
}

export function getWinners(): Player[] {
    return Object.values(players).sort((a, b) => b.wins - a.wins);
}

export function incrementWin(playerName: string): void {
    if (players[playerName]) {
        players[playerName].wins += 1;
    }
}
