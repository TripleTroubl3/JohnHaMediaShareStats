document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
});

function setupEventListeners() {
    const showMoreSongsBtn = document.getElementById('show-more-songs');
    if (showMoreSongsBtn) {
        showMoreSongsBtn.addEventListener('click', () => {
            renderMoreGlobalSongs();
        });
    }

    const searchSongsInput = document.getElementById('search-songs');
    if (searchSongsInput) {
        searchSongsInput.addEventListener('input', (e) => handleSearch(e, allGlobalSongs, '#global-songs-table tbody', 'show-more-songs-container', createSongRow, 'title', true));
    }

    const searchUsersInput = document.getElementById('search-users');
    if (searchUsersInput) {
        searchUsersInput.addEventListener('input', (e) => handleSearch(e, allUsers, '#users-tbody', 'show-more-container', createUserRow, 'username', false));
    }

    const showMoreBtn = document.getElementById('show-more-users');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            renderMoreUsers();
        });
    }

    const userModal = document.getElementById('user-modal');
    const songModal = document.getElementById('song-modal');

    [userModal, songModal].forEach(modal => {
        if (!modal) return;
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === userModal || event.target === songModal) {
            event.target.style.display = 'none';
        }
    });
}

function formatTime(totalSeconds) {
    if (!totalSeconds) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

async function fetchData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Failed to load data');

        const data = await response.json();
        renderData(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('last-updated').textContent = 'Error loading data.';
    }
}

let allGlobalSongs = [];
let currentGlobalSongCount = 0;
const GLOBAL_BATCH_SIZE = 50;


function createSongRow(song, rank) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${rank}</td>
        <td><a href="https://youtu.be/${escapeHtml(song.videoId)}" target="_blank" rel="noopener noreferrer" class="song-link">${escapeHtml(song.title)}</a></td>
        <td>${song.count}</td>
        <td>${formatTime(song.totalSeconds)}</td>
    `;

    tr.addEventListener('click', (e) => {
        if (!e.target.closest('a.song-link')) {
            openSongModal(song);
        }
    });
    return tr;
}

function renderMoreGlobalSongs() {
    const globalTbody = document.querySelector('#global-songs-table tbody');
    const showMoreSongsContainer = document.getElementById('show-more-songs-container');

    const nextBatch = allGlobalSongs.slice(currentGlobalSongCount, currentGlobalSongCount + GLOBAL_BATCH_SIZE);

    nextBatch.forEach((song) => {
        globalTbody.appendChild(createSongRow(song, song.originalRank));
    });

    currentGlobalSongCount += nextBatch.length;

    if (showMoreSongsContainer) {
        showMoreSongsContainer.style.display = currentGlobalSongCount >= allGlobalSongs.length ? 'none' : 'block';
    }
}

function handleSearch(event, dataset, tbodySelector, showMoreId, createRowFn, searchField, isSongs) {
    const query = event.target.value.toLowerCase();
    const tbody = document.querySelector(tbodySelector);
    const showMoreContainer = document.getElementById(showMoreId);

    tbody.innerHTML = '';

    if (query) {
        const filteredData = dataset.filter(item => {
            const val = item[searchField];
            return val ? val.toLowerCase().includes(query) : false;
        });

        const fragment = document.createDocumentFragment();
        filteredData.forEach(item => {
            fragment.appendChild(createRowFn(item, item.originalRank));
        });
        tbody.appendChild(fragment);

        if (showMoreContainer) showMoreContainer.style.display = 'none';
    } else {
        if (isSongs) {
            currentGlobalSongCount = 0;
            renderMoreGlobalSongs();
        } else {
            currentDisplayCount = 0;
            renderMoreUsers();
        }
    }
}

let allUsers = [];
let currentDisplayCount = 0;
const BATCH_SIZE = 50;

function renderData(data) {
    if (data.lastUpdated) {
        document.getElementById('last-updated').textContent = `Last updated: ${new Date(data.lastUpdated).toLocaleString()}`;
    }

    // Render Global Stats
    const globalTotal = document.getElementById('global-total-time');
    globalTotal.textContent = formatTime(data.stats.global.totalSeconds);

    const globalRequests = document.getElementById('global-total-requests');
    if (globalRequests && data.stats.global.totalRequests !== undefined) {
        globalRequests.textContent = data.stats.global.totalRequests.toLocaleString();
    }

    // Setup Global Songs
    allGlobalSongs = data.stats.global.topSongs.map((song, idx) => ({...song, originalRank: idx + 1}));
    currentGlobalSongCount = 0;

    const globalTbody = document.querySelector('#global-songs-table tbody');
    if (globalTbody) {
        globalTbody.innerHTML = '';
        renderMoreGlobalSongs();
    }

    // Setup Users
    allUsers = data.stats.users.map((user, idx) => ({...user, originalRank: idx + 1}));
    currentDisplayCount = 0;

    const usersTbody = document.getElementById('users-tbody');
    if (usersTbody) {
        usersTbody.innerHTML = '';
        renderMoreUsers();
    }
}

function createUserRow(user, rank) {
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${rank}</td>
        <td>${escapeHtml(user.username)}</td>
        <td>${user.totalRequests || 0}</td>
        <td>${formatTime(user.totalSeconds)}</td>
    `;

    tr.addEventListener('click', () => openUserModal(user));
    return tr;
}

function renderMoreUsers() {
    const usersTbody = document.getElementById('users-tbody');
    const showMoreContainer = document.getElementById('show-more-container');

    const nextBatch = allUsers.slice(currentDisplayCount, currentDisplayCount + BATCH_SIZE);

    nextBatch.forEach((user) => {
        usersTbody.appendChild(createUserRow(user, user.originalRank));
    });

    currentDisplayCount += nextBatch.length;

    if (showMoreContainer) {
        showMoreContainer.style.display = currentDisplayCount >= allUsers.length ? 'none' : 'block';
    }
}

function openUserModal(user) {
    const modal = document.getElementById('user-modal');
    const modalUsername = document.getElementById('modal-username');
    const modalUserTotal = document.getElementById('modal-user-total');
    const modalSongsContainer = document.getElementById('modal-songs-container');

    modalUsername.textContent = `${user.username}'s Top Requested Songs`;
    modalUserTotal.textContent = `Total Requests: ${user.totalRequests || 0} | Total Time: ${formatTime(user.totalSeconds)}`;

    const getTooltipHtml = (videoId) => {
        if (!user.messages) return '';
        const relevantMessages = user.messages.filter(m => m.videoId === videoId);
        if (relevantMessages.length === 0) return '';

        const uniqueMessages = [...new Set(relevantMessages.map(m => m.message))];
        const messagesList = uniqueMessages.map(m => `"${escapeHtml(m)}"`).join('<br>');

        return ` <span class="has-tooltip">*<span class="tooltip">Messages attached to requests:<br>${messagesList}</span></span>`;
    };

    let songsHtml = `
        <table>
            <thead>
                <tr>
                    <th>Song</th>
                    <th>Requests</th>
                    <th>Total Time</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (user.topSongs && user.topSongs.length > 0) {
        user.topSongs.forEach(song => {
            // Check if link was clicked, so we don't also trigger row click (though here it's just content)
            songsHtml += `
                <tr>
                    <td>
                        <a href="https://youtu.be/${escapeHtml(song.videoId)}" target="_blank" rel="noopener noreferrer">${escapeHtml(song.title)}</a>
                        ${getTooltipHtml(song.videoId)}
                    </td>
                    <td>${song.count}</td>
                    <td>${formatTime(song.totalSeconds)}</td>
                </tr>
            `;
        });
    } else {
        songsHtml += `<tr><td colspan="3">No songs found.</td></tr>`;
    }

    songsHtml += `</tbody></table>`;
    modalSongsContainer.innerHTML = songsHtml;

    modal.style.display = 'block';
}

function openSongModal(song) {
    const modal = document.getElementById('song-modal');
    const modalTitle = document.getElementById('modal-song-title');
    const modalTotal = document.getElementById('modal-song-total');
    const modalContainer = document.getElementById('modal-song-users-container');

    modalTitle.textContent = `Users who requested "${song.title}"`;
    modalTotal.textContent = `Total Requests: ${song.count} | Total Time: ${formatTime(song.totalSeconds)}`;

    let songUsers = song.users;

    // Dynamically compute users if not pre-computed
    if (!songUsers) {
        const usersMap = new Map();

        allUsers.forEach(user => {
            const userSong = user.topSongs.find(s => s.videoId === song.videoId);
            if (userSong) {
                usersMap.set(user.username, {
                    username: user.username,
                    count: userSong.count,
                    totalSeconds: userSong.totalSeconds
                });
            }
        });

        songUsers = Array.from(usersMap.values())
            .sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds);

        // Cache it for next time
        song.users = songUsers;
    }

    let usersHtml = `
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Username</th>
                    <th>Requests</th>
                    <th>Total Time</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (songUsers && songUsers.length > 0) {
        songUsers.forEach((user, index) => {
            usersHtml += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${user.count}</td>
                    <td>${formatTime(user.totalSeconds)}</td>
                </tr>
            `;
        });
    } else {
        usersHtml += `<tr><td colspan="4">No users found.</td></tr>`;
    }

    usersHtml += `</tbody></table>`;
    modalContainer.innerHTML = usersHtml;

    modal.style.display = 'block';
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
