import express, { json } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { SocketConnection } from './modules/util.ts';
import { MongoDatabase } from './modules/database.ts';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    console.error('JWT secret not provided');
    process.exit(1);
}

app.use(cors());
app.use(json());

const socketConnections: { [key: string]: SocketConnection } = {};
const db = new MongoDatabase();

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userID = await db.loginUser(username, password);
        const token = jwt.sign({ userID }, jwtSecret, { expiresIn: '1h' });
        res.json({ userID, token, username, success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userID = await db.createUser(username, password);
        const token = jwt.sign({ userID }, jwtSecret, { expiresIn: '1h' });

        res.json({ userID, token, username, success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/refreshlogin', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        res.status(400).json({ error: 'No token provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (typeof decoded === 'string') {
            throw new Error('Invalid token');
        }

        const user = await db.getUser(decoded.userID);
        if (!user) {
            throw new Error('User not found');
        }

        res.json({ userID: decoded.userID, username: user.username, success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Handle WebSocket connections
io.on('connection', async (socket: Socket) => {
    console.log('A user connected:', socket.id);
    socketConnections[socket.id] = new SocketConnection(socket, io, db);

    // Create a lobby
    socket.on('createLobby', async (lobbyID: string) => {
        try {
            await socketConnections[socket.id].createLobby(lobbyID);
        } catch (error: any) {
            socket.emit('lobbyError', error.message);
            return;
        }
    });

    // Join a lobby
    socket.on('joinLobby', async (lobbyID: string) => {
        try {
            await socketConnections[socket.id].joinLobby(lobbyID);
        } catch (error: any) {
            socket.emit('lobbyError', error.message);
            return;
        }
    });

    // Leave a lobby
    socket.on('leaveLobby', async (lobbyID: string) => {
        try {
            await socketConnections[socket.id].leaveLobby(lobbyID);
        } catch (error: any) {
            socket.emit('lobbyError', error.message);
            return;
        }
    });

    socket.on('login', (userID: string) => {
        socketConnections[socket.id].setUserID(userID);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        try {
            console.log(`User ${socket.id} disconnected`);
            socketConnections[socket.id].disconnectUser();
            delete socketConnections[socket.id];
        } catch (error: any) {
            console.log(error);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
