import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
    if (!socket) {
        socket = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
        });
        
        socket.on('connect', () => {
            console.log('[Socket] Connected to backend:', socket?.id);
        });
        
        socket.on('disconnect', () => {
            console.log('[Socket] Disconnected from backend');
        });
    }
    return socket;
};
