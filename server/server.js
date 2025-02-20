const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { faker } = require('@faker-js/faker');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

app.use(cors());

const users = {}; // Store users { userID: { socketID, username } }
const lobbies = {}; // Store lobbies { lobbyID: { players: [] } }

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create a lobby
    socket.on('createLobby', (lobbyID) => {
        if (!lobbies[lobbyID]) {
            lobbies[lobbyID] = { players: [] };
            console.log(`Lobby ${lobbyID} created`);
        }
        socket.join(lobbyID);
        lobbies[lobbyID].players.push(users[socket.id]);
        io.to(lobbyID).emit('updateLobby', lobbies[lobbyID]);
    });

    // Join a lobby
    socket.on('joinLobby', (lobbyID) => {
        if (lobbies[lobbyID]) {
            socket.join(lobbyID);
            lobbies[lobbyID].players = lobbies[lobbyID].players.filter(
                (id) => id !== socket.id
            );
            lobbies[lobbyID].players.push(users[socket.id]);
            console.log(`User ${socket.id} joined lobby ${lobbyID}`);
            io.to(lobbyID).emit('updateLobby', lobbies[lobbyID]);
        } else {
            socket.emit('lobbyNotFound');
        }
    });

    // Leave a lobby
    socket.on('leaveLobby', (lobbyID) => {
        if (lobbies[lobbyID]) {
            lobbies[lobbyID].players = lobbies[lobbyID].players.filter(
                (id) => id !== socket.id
            );
            socket.leave(lobbyID);
            io.to(lobbyID).emit('updateLobby', lobbies[lobbyID]);
        }
    });

    socket.on('login', (username) => {
        users[socket.id] = { socketID: socket.id, username };
        console.log(`User ${socket.id} logged in as ${username}`);
        socket.emit('loginSuccess', { userID: socket.id, username });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        for (let lobbyID in lobbies) {
            lobbies[lobbyID].players = lobbies[lobbyID].players.filter(
                (id) => id !== socket.id
            );
            io.to(lobbyID).emit('updateLobby', lobbies[lobbyID]);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});
