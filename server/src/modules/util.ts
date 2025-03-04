import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { Server, Socket } from 'socket.io';
import { Database } from './database.ts';
dotenv.config();

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/`;

const client = new MongoClient(atlasURI);

const lobbiesDB = client.db('socket-test').collection('lobbies');

export class socketConnection {
    socket: Socket;
    io: Server;
    db: Database;
    constructor(socket: Socket, io: Server, db: Database) {
        this.io = io;
        this.socket = socket;
        this.db = db;
    }

    async createLobby(lobbyId: string, host: string) {
        try {
            await this.db.createLobby(lobbyId, host);
            await this.socket.join(lobbyId);
            await this.updateLobbyMembers(lobbyId);
        } catch (error: any) {
            this.socket.emit('lobbyError', error.message);
            return;
        }
    }

    async joinLobby(lobbyId: string, host: string) {
        try {
            await this.db.joinLobby(lobbyId, host);
            await this.socket.join(lobbyId);
            await this.updateLobbyMembers(lobbyId);
        } catch (error: any) {
            this.socket.emit('lobbyError', error.message);
            return;
        }
    }

    async leaveLobby(lobbyId: string, userID: string) {
        try {
            await this.db.leaveLobby(lobbyId, userID);
            await this.socket.leave(lobbyId);
            await this.updateLobbyMembers(lobbyId);
        } catch (error: any) {
            this.socket.emit('lobbyError', error.message);
            return;
        }
    }

    async disconnectUser(userID: string) {
        const user = await this.db.getUser(userID);

        if (user.lobbyId) {
            await this.db.leaveLobby(user.lobbyId, userID);
        }
    }

    async updateLobby(lobbyId: string) {
        const lobby = await lobbiesDB.findOne({ lobbyId });
        if (!lobby) {
            throw new Error('Lobby not found');
        }

        this.io.to(lobbyId).emit('updateLobby', lobby.members);
    }

    private async updateLobbyMembers(lobbyId: string) {
        const lobbyMembers = await this.db.getLobbyMembers(lobbyId);
        console.log(lobbyMembers);

        this.io.to(lobbyId).emit('updateLobby', lobbyMembers);
    }
}
