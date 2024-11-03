const rooms: { roomId: number, players: any[] }[] = [];
let roomIdCounter = 1;

export function createRoom() {
    const newRoom = { roomId: roomIdCounter++, players: [] };
    rooms.push(newRoom);
    return newRoom.roomId;
}

export function getAvailableRooms() {
    return rooms.filter(room => room.players.length < 2);
}

export function addUserToRoom(indexRoom: number, playerName: string, ws: WebSocket) {
    const room = getRoomById(indexRoom);
    if (!room) throw new Error('Room not found');
    if (room.players.length >= 2) throw new Error('Room is full');

    room.players.push({ name: playerName, ships: [], ws });
    return room.roomId;
}

export function getRoomById(roomId: number) {
    return rooms.find(room => room.roomId === roomId);
}
