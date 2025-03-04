import { Db, MongoClient, ObjectId } from 'mongodb';
import { hash, compare } from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const uri = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/`;

const saltRounds = 10;

export abstract class Database {
    abstract connect(): void;
    abstract createUser(username: string, password: string): Promise<string>;
    abstract loginUser(username: string, password: string): Promise<string>;
    abstract getUser(userId: string): Promise<any>;
    abstract createLobby(lobbyId: string, host: string): Promise<void>;
    abstract joinLobby(lobbyId: string, userId: string): Promise<void>;
    abstract leaveLobby(lobbyId: string, userId: string): Promise<void>;
    abstract getLobbyMembers(lobbyId: string): Promise<string[]>;
}

export class MongoDatabase extends Database {
    private db: Db;
    private userCollection;
    private lobbiesCollection;

    constructor() {
        super();
        this.db = new MongoClient(uri).db('socket-test');
        this.connect();

        this.userCollection = this.db.collection('users');
        this.lobbiesCollection = this.db.collection('lobbies');
    }

    connect(): void {
        return;
    }
    async createUser(username: string, password: string): Promise<string> {
        const user = await this.userCollection.findOne({ username });
        if (user) {
            throw new Error('Username already exists');
        }

        const hashedPassword = await hash(password, saltRounds);
        const result = await this.userCollection.insertOne({
            username,
            hashedPassword,
            lobbyId: null,
        });
        return result.insertedId.toHexString();
    }

    async loginUser(username: string, password: string): Promise<string> {
        const user = await this.userCollection.findOne({ username });
        if (!user) {
            throw new Error('User not found');
        }

        const isPasswordMatch = await compare(password, user.hashedPassword);
        if (!isPasswordMatch) {
            throw new Error('Invalid password');
        }

        return user._id.toHexString();
    }

    async getUser(userId: string) {
        const user = await this.userCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    async createLobby(lobbyId: string, host: string): Promise<void> {
        const lobby = await this.lobbiesCollection.findOne({ lobbyId });
        if (lobby) {
            throw new Error('Lobby already exists');
        }

        const result = await this.lobbiesCollection.insertOne({
            lobbyId,
            host,
            members: [],
        });

        if (!result || !result.acknowledged) {
            throw new Error('Failed to create lobby');
        }

        await this.joinLobby(lobbyId, host);
    }

    async joinLobby(lobbyId: string, userId: string): Promise<void> {
        const lobby = await this.lobbiesCollection.findOne({ lobbyId });
        if (!lobby) {
            throw new Error('Lobby not found');
        }

        if (lobby.members.includes(userId)) {
            throw new Error('User already in lobby');
        }

        const user = await this.userCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            throw new Error('User not found');
        }

        if (user.lobbyId) {
            throw new Error('User already in lobby');
        }

        lobby.members.push(userId);
        const result = await this.lobbiesCollection.updateOne(
            { lobbyId },
            { $set: { members: lobby.members } }
        );
        if (!result || !result.acknowledged) {
            throw new Error('Failed to join lobby');
        }

        const userUpdateResult = await this.userCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { lobbyId } }
        );

        if (!userUpdateResult || !userUpdateResult.acknowledged) {
            throw new Error('Failed to update user');
        }
    }

    async leaveLobby(lobbyId: string, userId: string): Promise<void> {
        const lobby = await this.lobbiesCollection.findOne({ lobbyId });
        if (!lobby) {
            throw new Error('Lobby not found');
        }

        if (!lobby.members.includes(userId)) {
            throw new Error('User not in lobby');
        }

        lobby.members = lobby.members.filter((member: string) => member !== userId);
        const result = await this.lobbiesCollection.updateOne(
            { lobbyId },
            { $set: { members: lobby.members } }
        );

        if (!result || !result.acknowledged) {
            throw new Error('Failed to leave lobby');
        }

        const userUpdateResult = await this.userCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { lobbyId: null } }
        );

        if (!userUpdateResult || !userUpdateResult.acknowledged) {
            throw new Error('Failed to update user');
        }

        if (lobby.members.length === 0) {
            await this.lobbiesCollection.deleteOne({ lobbyId });
            console.log('Deleted lobby:', lobbyId);
        }
    }

    async getLobbyMembers(lobbyId: string): Promise<string[]> {
        const lobby = await this.lobbiesCollection.findOne({ lobbyId });
        if (!lobby) {
            throw new Error('Lobby not found');
        }

        const memberUsernames: string[] = [];
        for (const member of lobby.members) {
            if (typeof member !== 'string') {
                continue;
            }
            const user = await this.userCollection.findOne({
                _id: new ObjectId(member),
            });
            if (user) {
                memberUsernames.push(user.username);
            }
        }

        return memberUsernames;
    }
}
