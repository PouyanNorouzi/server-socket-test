import express, { json } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { socketConnection } from './modules/util.ts';
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

app.use(cors());
app.use(json());

const usersDict: { [key: string]: string } = {};
const socketConnections: { [key: string]: socketConnection } = {};
const db = new MongoDatabase();

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const userID = await db.loginUser(username, password);
        res.json({ userID, success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userID = await db.createUser(username, password);
        res.json({ userID, success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Handle WebSocket connections
io.on('connection', async (socket: Socket) => {
    console.log('A user connected:', socket.id);
    socketConnections[socket.id] = new socketConnection(socket, io, db);

    // Create a lobby
    socket.on('createLobby', async (lobbyID: string, userID: string) => {
        try {
            await socketConnections[socket.id].createLobby(lobbyID, userID);
            console.log(`User ${userID} created lobby ${lobbyID}`);
        } catch (error: any) {
            socket.emit('lobbyError', error.message);
            return;
        }
    });

    // Join a lobby
    socket.on('joinLobby', async (lobbyID: string, userID: string) => {
        try {
            await socketConnections[socket.id].joinLobby(lobbyID, userID);
            console.log(`User ${userID} joined lobby ${lobbyID}`);
        } catch (error: any) {
            socket.emit('lobbyError', error.message);
            return;
        }
    });

    // Leave a lobby
    socket.on('leaveLobby', async (lobbyID: string, userID: string) => {
        try {
            await socketConnections[socket.id].leaveLobby(lobbyID, userID);
            console.log(`User ${userID} left lobby ${lobbyID}`);
        } catch (error: any) {
            socket.emit('lobbyError', error.message);
            return;
        }
    });

    socket.on('login', (userID: string) => {
        usersDict[socket.id] = userID;
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        const userID = usersDict[socket.id];
        if (userID) {
            socketConnections[socket.id].disconnectUser(userID);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
