<script setup>
import { ref, onMounted } from 'vue';
import { io } from 'socket.io-client';

// ✅ Connect to the Express WebSocket server
const socket = io('http://localhost:3000');

const lobbyID = ref('');
const username = ref('');
const password = ref('');
const players = ref([]);
const lobbyJoined = ref(false);
const errorMessage = ref('');
const loggedIn = ref(false);

// ✅ Function to create a new lobby
const createLobby = () => {
    if (!lobbyID.value || !loggedIn.value) return;
    socket.emit('createLobby', lobbyID.value);
};

// ✅ Function to join an existing lobby
const joinLobby = () => {
    if (!lobbyID.value || !loggedIn.value) return;
    socket.emit('joinLobby', lobbyID.value);
};

// ✅ Function to leave the current lobby
const leaveLobby = () => {
    socket.emit('leaveLobby', lobbyID.value);
    lobbyJoined.value = false;
    players.value = [];
};

const login = async () => {
    if (!username.value || !password.value) return;

    try {
        const result = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username.value,
                password: password.value,
            }),
        });
        const data = await result.json();
        if (data.success) {
            loggedIn.value = true;
            const { userID, username, token } = data;

            localStorage.setItem('token', token);
            username.value = username;
            socket.emit('login', userID);
        } else {
            console.log('Login failed', data.error);
        }
    } catch (error) {
        console.log(error);
    }
};

const signup = async () => {
    if (!username.value | !password.value) return;

    try {
        const result = await fetch('http://localhost:3000/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username.value,
                password: password.value,
            }),
        });
        const data = await result.json();
        if (data.success) {
            loggedIn.value = true;
            const { userID, username, token } = data;

            localStorage.setItem('token', token);
            username.value = username;
            socket.emit('login', userID);
        } else {
            console.log('Signup failed');
        }
    } catch (error) {
        console.log(error);
    }
};

const refreshLogin = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const result = await fetch('http://localhost:3000/api/refreshlogin', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await result.json();
        if (data.success) {
            loggedIn.value = true;
            username.value = data.username;
            socket.emit('login', data.userID);
        } else {
            console.log('User not logged in');
        }
    } catch (error) {
        console.log(error);
    }
};

// ✅ Listen for lobby updates
onMounted(() => {
    //TODO: think about it
    document.addEventListener('beforeunload', () => {
        socket.emit('leavelobby', lobbyID.value);
    });

    socket.on('updateLobby', (newPlayers) => {
        console.log('updateLobby', players);
        players.value = newPlayers;
        lobbyJoined.value = true;
        errorMessage.value = '';
    });

    socket.on('lobbyNotFound', () => {
        errorMessage.value = 'Lobby not found!';
    });

    socket.on('lobbyFull', () => {
        errorMessage.value = 'Lobby is full!';
    });

    socket.on('lobbyError', (error) => {
        errorMessage.value = error;
    });

    refreshLogin();
});
</script>

<template>
    <div>
        <h1>🎮 Lobby System</h1>
        <div :hidden="loggedIn">
            <input v-model="username" type="text" placeholder="Enter username" />
            <input v-model="password" type="password" placeholder="Enter password" />
            <button @click="login">Login</button>
            <button @click="signup">Signup</button>
        </div>
        <div :hidden="!loggedIn">Logged in as {{ username }}</div>

        <div v-if="!lobbyJoined" class="flex flex-col gap-4">
            <input v-model="lobbyID" type="text" placeholder="Enter Lobby ID" />

            <button @click="createLobby">Create Lobby</button>
            <button @click="joinLobby">Join Lobby</button>

            <p v-if="errorMessage">{{ errorMessage }}</p>
        </div>

        <div v-else>
            <h2>Lobby: {{ lobbyID }}</h2>
            {{ players.length }} players in the lobby
            <ul>
                <li v-for="player in players" :key="player">👤 {{ player }}</li>
            </ul>
            <button @click="leaveLobby">Leave Lobby</button>
        </div>
    </div>
</template>

<style scoped>
/* Simple styling */
button {
    width: 200px;
}
</style>
