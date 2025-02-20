<script setup>
import { ref, onMounted } from 'vue';
import { io } from 'socket.io-client';

// ✅ Connect to the Express WebSocket server
const socket = io('http://localhost:3000');

const lobbyID = ref('');
const username = ref('');
const players = ref([]);
const lobbyJoined = ref(false);
const errorMessage = ref('');
const loggedIn = ref(false);

// ✅ Function to create a new lobby
const createLobby = () => {
    if (!lobbyID.value) return;
    socket.emit('createLobby', lobbyID.value);
};

// ✅ Function to join an existing lobby
const joinLobby = () => {
    if (!lobbyID.value || !loggedIn.value) return;
    socket.emit('joinLobby', lobbyID.value);
};

const login = () => {
    if (!username.value) return;
    socket.emit('login', username.value);
    loggedIn.value = true;
};

// ✅ Listen for lobby updates
onMounted(() => {
    socket.on('updateLobby', (lobby) => {
        players.value = lobby.players;
        lobbyJoined.value = true;
        errorMessage.value = '';
    });

    socket.on('lobbyNotFound', () => {
        errorMessage.value = 'Lobby not found!';
    });

    socket.on('lobbyFull', () => {
        errorMessage.value = 'Lobby is full!';
    });
});
</script>

<template>
    <div class="flex flex-col items-center p-6">
        <h1 class="text-2xl font-bold mb-4">🎮 Lobby System</h1>
        <input v-model="username" type="text" placeholder="Enter username" class="border p-2 rounded w-64" />
        <button @click="login" class="bg-blue-500 text-white px-4 py-2 rounded">Login</button>

        <div v-if="!lobbyJoined" class="flex flex-col gap-4">
            <input v-model="lobbyID" type="text" placeholder="Enter Lobby ID" class="border p-2 rounded w-64" />
            
            <button @click="createLobby" class="bg-blue-500 text-white px-4 py-2 rounded">Create Lobby</button>
            <button @click="joinLobby" class="bg-green-500 text-white px-4 py-2 rounded">Join Lobby</button>
            
            <p v-if="errorMessage" class="text-red-500">{{ errorMessage }}</p>
        </div>

        <div v-else>
            <h2 class="text-lg font-semibold">Lobby: {{ lobbyID }}</h2>
            <ul class="mt-2">
                <li v-for="player in players" :key="player" class="text-gray-700">
                    👤 {{ player }}
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
/* Simple styling */
button {
    width: 200px;
}
</style>
