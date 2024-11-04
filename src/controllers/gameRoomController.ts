import { WebSocket } from 'ws';

import { createGame } from './gameController';
import { Player } from '../models/player';

interface Room {
    roomId: number;
    players: { player: Player; ws: WebSocket }[];
}

const rooms: Room[] = [];
let roomIdCounter = 1;

export function createRoom(): Room {
    const newRoom: Room = { roomId: roomIdCounter++, players: [] };
    rooms.push(newRoom);
    return newRoom;
}

export function getAvailableRooms(): Room[] {
    return rooms.filter(room => room.players.length < 2);
}

export function addUserToRoom(roomId: number, player: Player, ws: WebSocket): Room {
    const room = rooms.find(r => r.roomId === roomId);
    if (!room) {
        throw new Error('Room not found.');
    }
    if (room.players.length >= 2) {
        throw new Error('Room is full.');
    }

    room.players.push({ player, ws });


    return room;
}


export function getRoomById(roomId: number): Room | undefined {
    return rooms.find(room => room.roomId === roomId);
}

export function removeRoom(roomId: number): void {
    const index = rooms.findIndex(room => room.roomId === roomId);
    if (index !== -1) {
        rooms.splice(index, 1);
    }
}

export function getFormattedRooms() {
    return getAvailableRooms().map(room => ({
        roomId: room.roomId,
        roomUsers: room.players.map(p => ({
            name: p.player.name,
            index: p.player.index,
        })),
    }));
}
