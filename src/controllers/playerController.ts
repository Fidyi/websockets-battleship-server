const players: { [key: string]: { name: string, password: string, index: number } } = {};
let playerIndex = 0;

export function registerPlayer(name: string, password: string) {
    if (players[name]) {
        throw new Error('Player already exists.');
    }

    players[name] = { name, password, index: playerIndex++ };
    return players[name];
}
