import { WebSocket } from 'ws';
import { Player } from './player';

export interface ShipPosition {
    x: number;
    y: number;
}

export type ShipType = 'small' | 'medium' | 'large' | 'huge';

export interface Ship {
    position: ShipPosition;
    direction: boolean;
    type: ShipType;
    length: number;
}

export interface PlayerInGame {
    player: Player;
    ws: WebSocket;
    ships: Ship[];
    shipsGrid: number[][];
    index: number;
}

export interface Game {
    gameId: number;
    players: PlayerInGame[];
    currentTurn: number;
    start: boolean;
}
