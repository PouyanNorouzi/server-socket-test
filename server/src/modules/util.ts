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

export class SocketConnection {
    socket: Socket;
    io: Server;
    db: Database;
    userID: string | null;
    constructor(socket: Socket, io: Server, db: Database) {
        this.io = io;
        this.socket = socket;
        this.db = db;
        this.userID = null;
    }

    setUserID(userID: string) {
        this.userID = userID;
    }

    async createLobby(lobbyId: string) {
        if (!this.userID) {
            throw new Error('User not authenticated');
        }

        try {
            await this.db.createLobby(lobbyId, this.userID);
            await this.socket.join(lobbyId);
            await this.updateLobbyMembers(lobbyId);
        } catch (error: any) {
            this.socket.emit('lobbyError', error.message);
            return;
        }
    }

    async joinLobby(lobbyId: string) {
        if (!this.userID) {
            throw new Error('User not authenticated');
        }

        try {
            await this.db.joinLobby(lobbyId, this.userID);
            await this.socket.join(lobbyId);
            await this.updateLobbyMembers(lobbyId);
        } catch (error: any) {
            this.socket.emit('lobbyError', error.message);
            return;
        }
    }

    async leaveLobby(lobbyId: string) {
        if (!this.userID) {
            throw new Error('User not authenticated');
        }

        try {
            await this.db.leaveLobby(lobbyId, this.userID);
            await this.socket.leave(lobbyId);
            await this.updateLobbyMembers(lobbyId);
        } catch (error: any) {
            this.socket.emit('lobbyError', error.message);
            return;
        }
    }

    async disconnectUser() {
        if (!this.userID) {
            return;
        }
        const user = await this.db.getUser(this.userID);

        if (user.lobbyId) {
            await this.db.leaveLobby(user.lobbyId, this.userID);
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
