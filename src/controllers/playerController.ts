import { registerPlayer as dbRegisterPlayer, authenticatePlayer, getWinners } from '../db/inMemoryDB';

interface RegisterData {
    name: string;
    password: string;
}

interface LoginData {
    name: string;
    password: string;
}

export function handleRegister(data: RegisterData) {
    return dbRegisterPlayer(data.name, data.password);
}

export function handleLogin(data: LoginData) {
    return authenticatePlayer(data.name, data.password);
}

export function getWinnersData() {
    const winners = getWinners();
    return winners.map(player => ({
        name: player.name,
        wins: player.wins,
    }));
}
