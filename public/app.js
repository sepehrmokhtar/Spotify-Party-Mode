// Global state
let currentUser = null;
let currentSession = null;
let socket = null;
let accessToken = null;
let isDJ = false;
let pendingRequests = [];
let spotifyPlayer = null;
let deviceId = null;
let isPlaying = false;
let currentPopupRequest = null;

// DOM elements
const elements = {
    loginBtn: document.getElementById('loginBtn'),
    userInfo: document.getElementById('userInfo'),
    username: document.getElementById('username'),
    logoutBtn: document.getElementById('logoutBtn'),
    createSessionBtn: document.getElementById('createSessionBtn'),
    joinSessionBtn: document.getElementById('joinSessionBtn'),
    welcomeSection: document.getElementById('welcomeSection'),
    sessionInterface: document.getElementById('sessionInterface'),
    createModal: document.getElementById('createModal'),
    joinModal: document.getElementById('joinModal'),
    sessionName: document.getElementById('sessionName'),
    playlistId: document.getElementById('playlistId'),
    createConfirmBtn: document.getElementById('createConfirmBtn'),
    createCancelBtn: document.getElementById('createCancelBtn'),
    sessionCode: document.getElementById('sessionCode'),
    usernameInput: document.getElementById('usernameInput'),
    joinConfirmBtn: document.getElementById('joinConfirmBtn'),
    joinCancelBtn: document.getElementById('joinCancelBtn'),
    sessionTitle: document.getElementById('sessionTitle'),
    sessionCodeText: document.getElementById('sessionCodeText'),
    participantCount: document.getElementById('participantCount'),
    playNextBtn: document.getElementById('playNextBtn'),
    currentSongSection: document.getElementById('currentSongSection'),
    currentSongArt: document.getElementById('currentSongArt'),
    currentSongName: document.getElementById('currentSongName'),
    currentSongArtist: document.getElementById('currentSongArtist'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    searchResults: document.getElementById('searchResults'),
    queueList: document.getElementById('queueList'),
    statsSection: document.getElementById('statsSection'),
    totalVotes: document.getElementById('totalVotes'),
    songsPlayed: document.getElementById('songsPlayed'),
    activeUsers: document.getElementById('activeUsers'),
    pendingRequests: document.getElementById('pendingRequests'),
    requestPopup: document.getElementById('requestPopup'),
    popupAlbumArt: document.getElementById('popupAlbumArt'),
    popupSongName: document.getElementById('popupSongName'),
    popupArtistName: document.getElementById('popupArtistName'),
    popupRequesterName: document.getElementById('popupRequesterName'),
    popupAcceptBtn: document.getElementById('popupAcceptBtn'),
    popupDenyBtn: document.getElementById('popupDenyBtn')
};

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuthStatus();
});

function setupEventListeners() {
    elements.loginBtn.addEventListener('click', handleSpotifyLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);
    elements.createSessionBtn.addEventListener('click', () => showModal('createModal'));
    elements.joinSessionBtn.addEventListener('click', () => showModal('joinModal'));
    elements.createCancelBtn.addEventListener('click', () => hideModal('createModal'));
    elements.joinCancelBtn.addEventListener('click', () => hideModal('joinModal'));
    elements.createConfirmBtn.addEventListener('click', handleCreateSession);
    elements.joinConfirmBtn.addEventListener('click', handleJoinSession);
    elements.playNextBtn.addEventListener('click', handlePlayNext);
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.popupAcceptBtn.addEventListener('click', handlePopupAccept);
    elements.popupDenyBtn.addEventListener('click', handlePopupDeny);
}

function showRequestPopup(request) {
    if (!isDJ) return;
    currentPopupRequest = request;
    elements.popupSongName.textContent = request.name;
    elements.popupArtistName.textContent = request.artist;
    elements.popupRequesterName.textContent = request.requestedBy.username;
    elements.popupAlbumArt.src = request.albumArt || 'https://via.placeholder.com/60';
    elements.requestPopup.classList.remove('request-popup-hidden');
    setTimeout(() => {
        if (currentPopupRequest && currentPopupRequest.id === request.id) {
            hideRequestPopup();
        }
    }, 10000);
}

function hideRequestPopup() {
    elements.requestPopup.classList.add('request-popup-hidden');
    currentPopupRequest = null;
}

async function handlePopupAccept() {
    if (!currentPopupRequest) return;
    try {
        await approveRequest(currentPopupRequest.id);
        hideRequestPopup();
    } catch (error) {
        console.error('Error approving request from popup:', error);
    }
}

async function handlePopupDeny() {
    if (!currentPopupRequest) return;
    try {
        await denyRequest(currentPopupRequest.id);
        hideRequestPopup();
    } catch (error) {
        console.error('Error denying request from popup:', error);
    }
}

function checkAuthStatus() {
    const token = localStorage.getItem('spotify_access_token');
    if (token) {
        accessToken = token;
        currentUser = JSON.parse(localStorage.getItem('spotify_user') || '{}');
        updateAuthUI(true);
    }
}

function handleSpotifyLogin() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_user');
    window.location.href = '/auth/spotify';
}

function handleLogout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_user');
    accessToken = null;
    currentUser = null;
    updateAuthUI(false);
    showWelcomeSection();
}

function updateAuthUI(isLoggedIn) {
    if (isLoggedIn) {
        elements.loginBtn.classList.add('hidden');
        elements.userInfo.classList.remove('hidden');
        elements.username.textContent = currentUser.display_name || 'User';
        setTimeout(() => {
            initializeSpotifyPlayer();
        }, 1000);
    } else {
        elements.loginBtn.classList.remove('hidden');
        elements.userInfo.classList.add('hidden');
    }
}

function showModal(modalId) {
    if (modalId === 'createModal' && !accessToken) {
        alert('Please connect your Spotify account first!');
        return;
    }
    document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

async function handleCreateSession() {
    const sessionName = elements.sessionName.value.trim();
    const playlistId = elements.playlistId.value.trim();

    if (!sessionName) {
        alert('Please enter a session name');
        return;
    }

    try {
        const response = await fetch('/api/session/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken,
                sessionName,
                playlistId: playlistId || null,
                username: currentUser.display_name,
                userId: currentUser.id
            })
        });

        const data = await response.json();

        if (data.sessionId) {
            currentSession = data.session;
            isDJ = (currentSession.dj && currentSession.dj.userId === currentUser.id);
            hideModal('createModal');
            showSessionInterface();
            connectToSession(data.sessionId);
            updateDJUI();
        } else {
            alert('Failed to create session');
        }
    } catch (error) {
        console.error('Error creating session:', error);
        alert('Failed to create session');
    }
}

async function handleJoinSession() {
    try {
        if (!elements.sessionCode || !elements.usernameInput) {
            throw new Error('Form elements not found');
        }

        const sessionId = elements.sessionCode.value.trim();
        const username = elements.usernameInput.value.trim();

        if (!sessionId) {
            alert('Please enter a session code');
            return;
        }
        if (!username) {
            alert('Please enter your name');
            return;
        }

        const verifyResponse = await fetch(`/api/session/${sessionId}`);
        if (!verifyResponse.ok) {
            throw new Error('Session not found');
        }

        const joinResponse = await fetch('/api/session/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                username,
                userId: 'guest_' + Math.random().toString(36).substr(2, 9)
            })
        });

        if (!joinResponse.ok) {
            throw new Error('Failed to join session');
        }

        const data = await joinResponse.json();
        currentSession = data.session;
        isDJ = false;

        hideModal('joinModal');
        showSessionInterface();
        connectToSession(sessionId);
        updateDJUI();

    } catch (error) {
        console.error('Error joining session:', error);
        alert(`Error joining session: ${error.message}`);
    }
}

function initializeSpotifyPlayer() {
    if (!accessToken) {
        console.error("No access token for player initialization");
        return;
    }

    if (!window.Spotify) {
        console.error("Spotify SDK not loaded! Retrying in 1 second...");
        setTimeout(initializeSpotifyPlayer, 1000);
        return;
    }

    spotifyPlayer = new Spotify.Player({
        name: 'CTRL THE AUX Web Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        deviceId = device_id;
    });

    spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error("Initialization Error:", message);
    });

    spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error("Auth Error:", message);
    });

    spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error("Account Error:", message);
    });

    spotifyPlayer.connect().then(success => {
        if (success) {
            console.log("Connected to Spotify Player!");
        } else {
            console.error("Failed to connect to player");
        }
    });
}

async function playSongOnWebPlayer(songUri) {
    if (!spotifyPlayer || !deviceId) {
        alert('Web player not ready. Please wait or check your Spotify Premium subscription.');
        return false;
    }

    try {
        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [songUri]
            })
        });

        if (response.ok) {
            isPlaying = true;
            return true;
        } else {
            console.error('Failed to start playback:', response.statusText);
            return false;
        }
    } catch (error) {
        console.error('Error playing song:', error);
        return false;
    }
}

function showSessionInterface() {
    elements.welcomeSection.classList.add('hidden');
    elements.sessionInterface.classList.remove('hidden');
    elements.statsSection.classList.remove('hidden');
    updateSessionUI();
}

function showWelcomeSection() {
    elements.welcomeSection.classList.remove('hidden');
    elements.sessionInterface.classList.add('hidden');
    elements.statsSection.classList.add('hidden');
}

function updateSessionUI() {
    if (!currentSession) return;
    elements.sessionTitle.textContent = currentSession.name;
    elements.sessionCodeText.textContent = currentSession.id;
    elements.participantCount.textContent = `${currentSession.participants.length} participants`;
    if (currentSession.currentSong) {
        showCurrentSong(currentSession.currentSong);
    }
    updateQueueDisplay();
    updateStats();
}

function connectToSession(sessionId) {
    socket = io();
    socket.emit('joinSession', sessionId);

    socket.on('voteUpdate', (data) => {
        updateSongVotes(data.songId, data.votes);
    });

    socket.on('queueUpdate', (data) => {
        currentSession.queue = data.queue;
        updateQueueDisplay();
    });

    socket.on('songPlayed', (data) => {
        currentSession.currentSong = data.currentSong;
        currentSession.queue = data.queue;
        showCurrentSong(data.currentSong);
        updateQueueDisplay();
        updateStats();
    });

    socket.on('pendingRequestsUpdate', (data) => {
        pendingRequests = data.pendingRequests;
        updatePendingRequestsUI();
        if (isDJ && data.pendingRequests.length > 0) {
            const latestRequest = data.pendingRequests[data.pendingRequests.length - 1];
            if (!currentPopupRequest || currentPopupRequest.id !== latestRequest.id) {
                showRequestPopup(latestRequest);
            }
        }
    });

    if (isDJ) {
        fetch(`/api/session/${sessionId}/pending-requests`)
            .then(res => res.json())
            .then(data => {
                pendingRequests = data.pendingRequests || [];
                updatePendingRequestsUI();
            });
    }
}

function showCurrentSong(song) {
    elements.currentSongSection.classList.remove('hidden');
    elements.currentSongName.textContent = song.name;
    elements.currentSongArtist.textContent = song.artist;
    if (song.albumArt) {
        elements.currentSongArt.src = song.albumArt;
        elements.currentSongArt.style.display = 'block';
    } else {
        elements.currentSongArt.style.display = 'none';
    }
}

async function handleSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) return;

    try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&accessToken=${accessToken}`);
        const data = await response.json();
        displaySearchResults(data.tracks);
    } catch (error) {
        console.error('Error searching:', error);
    }
}

function displaySearchResults(tracks) {
    elements.searchResults.innerHTML = '';

    tracks.forEach(track => {
        const trackElement = document.createElement('div');
        trackElement.className = 'song-card rounded-lg p-4 flex items-center justify-between';
        trackElement.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="${track.albumArt || 'https://via.placeholder.com/40'}" alt="Album Art" class="w-10 h-10 rounded">
                <div>
                    <h4 class="text-white font-semibold">${track.name}</h4>
                    <p class="text-gray-300 text-sm">${track.artist}</p>
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
                    onclick="playSongOnWebPlayer('${track.uri}')">
                    <i class="fas fa-play"></i> Play
                </button>
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-plus"></i> ${isDJ ? 'Add to Queue' : 'Request Song'}
                </button>
            </div>
        `;
        trackElement.querySelector('button:nth-child(2)').onclick = () => {
            if (isDJ) {
                addSongToQueue(track);
            } else {
                requestSong(track);
            }
        };
        elements.searchResults.appendChild(trackElement);
    });
}

async function addSongToQueue(track) {
    if (!currentSession) return;
    try {
        const response = await fetch(`/api/session/${currentSession.id}/add-song`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                song: {
                    id: track.id,
                    name: track.name,
                    artist: track.artist,
                    uri: track.uri,
                    albumArt: track.albumArt || 'https://via.placeholder.com/40',
                    votes: 0
                }
            })
        });
        const data = await response.json();
        if (data.success) {
            elements.searchInput.value = '';
            elements.searchResults.innerHTML = '';
        }
    } catch (error) {
        console.error('Error adding song:', error);
    }
}

async function requestSong(track) {
    if (!currentSession) return;
    try {
        const response = await fetch(`/api/session/${currentSession.id}/request-song`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                song: {
                    id: track.id,
                    name: track.name,
                    artist: track.artist,
                    uri: track.uri,
                    albumArt: track.albumArt || 'https://via.placeholder.com/40'
                },
                requestedBy: {
                    username: currentUser ? currentUser.display_name : 'Guest',
                    userId: currentUser ? currentUser.id : 'guest'
                }
            })
        });
        const data = await response.json();
        if (data.success) {
            elements.searchInput.value = '';
            elements.searchResults.innerHTML = '<p class="text-green-400">Request sent!</p>';
        }
    } catch (error) {
        console.error('Error requesting song:', error);
    }
}

async function approveRequest(songId) {
    if (!currentSession) return;
    try {
        await fetch(`/api/session/${currentSession.id}/approve-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId, userId: currentUser.id })
        });
    } catch (error) {
        console.error('Error approving request:', error);
    }
}

async function denyRequest(songId) {
    if (!currentSession) return;
    try {
        await fetch(`/api/session/${currentSession.id}/deny-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId, userId: currentUser.id })
        });
    } catch (error) {
        console.error('Error denying request:', error);
    }
}

function updatePendingRequestsUI() {
    if (!isDJ || !elements.pendingRequests) return;
    if (!pendingRequests.length) {
        elements.pendingRequests.innerHTML = '<p class="text-gray-400">No pending song requests.</p>';
        return;
    }
    elements.pendingRequests.innerHTML = pendingRequests.map(req => `
        <div class="song-card rounded-lg p-4 flex items-center justify-between mb-2">
            <div class="flex items-center space-x-3">
                <img src="${req.albumArt || 'https://via.placeholder.com/40'}" alt="Album Art" class="w-10 h-10 rounded">
                <div>
                    <h4 class="text-white font-semibold">${req.name}</h4>
                    <p class="text-gray-300 text-sm">${req.artist}</p>
                    <p class="text-xs text-gray-400">Requested by: ${req.requestedBy.username}</p>
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded" onclick="approveRequest('${req.id}')">Approve</button>
                <button class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded" onclick="denyRequest('${req.id}')">Deny</button>
            </div>
        </div>
    `).join('');
}

function updateDJUI() {
    if (isDJ) {
        elements.playNextBtn.classList.remove('hidden');
        if (elements.pendingRequests) elements.pendingRequests.classList.remove('hidden');
        const roleIndicator = document.getElementById('roleIndicator');
        if (roleIndicator) roleIndicator.classList.remove('hidden');
    } else {
        elements.playNextBtn.classList.add('hidden');
        if (elements.pendingRequests) elements.pendingRequests.classList.add('hidden');
    }
}

function updateQueueDisplay() {
    if (!currentSession || !currentSession.queue.length) {
        elements.queueList.innerHTML = '<p class="text-gray-300 text-center py-8">No songs in queue. Search and add some songs to get started!</p>';
        return;
    }

    const sortedQueue = [...currentSession.queue].sort((a, b) => b.votes - a.votes);

    elements.queueList.innerHTML = sortedQueue.map((song, index) => `
        <div class="song-card rounded-lg p-4 flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <img src="${song.albumArt || 'https://via.placeholder.com/40'}" alt="Album Art" class="w-12 h-12 rounded">
                <div class="text-center">
                    <div class="text-2xl font-bold text-white">${index + 1}</div>
                    <div class="text-sm text-gray-300">${song.votes} votes</div>
                </div>
                <div>
                    <h4 class="text-white font-semibold">${song.name}</h4>
                    <p class="text-gray-300">${song.artist}</p>
                </div>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="voteSong('${song.id}', 'up')"
                        class="vote-animation bg-green-500 hover:bg-green-600 text-white p-2 rounded-full">
                    <i class="fas fa-thumbs-up"></i>
                </button>
                <button onclick="voteSong('${song.id}', 'down')"
                        class="vote-animation bg-red-500 hover:bg-red-600 text-white p-2 rounded-full">
                    <i class="fas fa-thumbs-down"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function voteSong(songId, voteType) {
    if (!currentSession) return;

    try {
        const response = await fetch(`/api/session/${currentSession.id}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                songId,
                username: currentUser ? currentUser.display_name : 'Guest',
                voteType
            })
        });

        const data = await response.json();
        if (data.success) {
            // Update will come through socket
        }
    } catch (error) {
        console.error('Error voting:', error);
    }
}

function updateSongVotes(songId, votes) {
    if (currentSession) {
        const song = currentSession.queue.find(s => s.id === songId);
        if (song) {
            song.votes = votes;
            updateQueueDisplay();
        }
    }
}

async function handlePlayNext() {
    if (!currentSession) return;

    try {
        currentSession.queue.sort((a, b) => b.votes - a.votes);
        const nextSong = currentSession.queue[0];

        if (!nextSong) {
            alert('No songs in queue');
            return;
        }

        const success = await playSongOnWebPlayer(nextSong.uri);

        if (success) {
            currentSession.queue.shift();
            currentSession.currentSong = nextSong;
            showCurrentSong(nextSong);
            updateQueueDisplay();
            updateStats();

            if (socket) {
                socket.emit('songPlayed', {
                    currentSong: nextSong,
                    queue: currentSession.queue
                });
            }
        } else {
            const response = await fetch(`/api/session/${currentSession.id}/play-next`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken })
            });

            const data = await response.json();
            if (!data.success) {
                alert('No songs in queue or failed to play');
            }
        }
    } catch (error) {
        console.error('Error playing next song:', error);
        alert('Failed to play next song');
    }
}

function updateStats() {
    if (!currentSession) return;
    const totalVotes = currentSession.queue.reduce((sum, song) => sum + song.votes, 0);
    elements.totalVotes.textContent = totalVotes;
    elements.activeUsers.textContent = currentSession.participants.length;
    elements.songsPlayed.textContent = '0';
}

window.playSongOnWebPlayer = playSongOnWebPlayer;
