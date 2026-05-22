import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';
import { API_BASE_URL } from '@/utils/api-base-url.ts';

const URL = import.meta.env.VITE_API_URL ? API_BASE_URL : undefined;
const path = import.meta.env.VITE_API_URL ? '/websocket' : '/api/websocket';

const socket: Socket = io(URL, {
    path,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    timeout: 20000
});

const joinedRooms = new Map<string, number>();

export const socketConnected = ref(socket.connected);
export const socketReconnecting = ref(false);
export const socketReconnectAttempt = ref(0);
export const socketLastError = ref('');

socket.on('connect', () => {
    socketConnected.value = true;
    socketReconnecting.value = false;
    socketReconnectAttempt.value = 0;
    socketLastError.value = '';
    console.log('WebSocket connected', socket.id);
    for (const room of joinedRooms.keys()) {
        socket.emit('join', room);
    }
});

socket.on('disconnect', () => {
    socketConnected.value = false;
    console.log('WebSocket disconnected');
});

socket.io.on('reconnect_attempt', attempt => {
    socketReconnecting.value = true;
    socketReconnectAttempt.value = attempt;
});

socket.io.on('reconnect_error', error => {
    socketLastError.value = error.message;
});

socket.io.on('reconnect_failed', () => {
    socketReconnecting.value = false;
    socketLastError.value = 'WebSocket reconnect failed';
});

export const joinRoom = (room: string) => {
    const currentCount = joinedRooms.get(room) || 0;
    joinedRooms.set(room, currentCount + 1);
    if (currentCount === 0 && socket.connected) socket.emit('join', room);
};

export const leaveRoom = (room: string) => {
    const currentCount = joinedRooms.get(room) || 0;
    if (currentCount <= 1) {
        joinedRooms.delete(room);
        if (socket.connected) socket.emit('leave', room);
        return;
    }

    joinedRooms.set(room, currentCount - 1);
};

export default {
    getInstance() {
        return socket;
    },
    leaveRoom,
    joinRoom
};
