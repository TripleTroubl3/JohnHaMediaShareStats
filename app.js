document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setupEventListeners();
});


function setupEventListeners() {
    setupColorChooser();
    const showMoreSongsBtn = document.getElementById('show-more-songs');
    if (showMoreSongsBtn) {
        showMoreSongsBtn.addEventListener('click', () => {
            renderMore('songs');
        });
    }

    const searchSongsInput = document.getElementById('search-songs');
    if (searchSongsInput) {
        const onSearchSongs = debounce((e) => handleSearch(e.target.value, 'songs'), 180);
        searchSongsInput.addEventListener('input', onSearchSongs);
        searchSongsInput.addEventListener('search', onSearchSongs);
    }

    const searchUsersInput = document.getElementById('search-users');
    if (searchUsersInput) {
        const onSearchUsers = debounce((e) => handleSearch(e.target.value, 'users'), 180);
        searchUsersInput.addEventListener('input', onSearchUsers);
        searchUsersInput.addEventListener('search', onSearchUsers);
    }

    const showMoreBtn = document.getElementById('show-more-users');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            renderMore('users');
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

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            if (targetEl) targetEl.classList.add('active');
        });
    });

    // Sorting logic for headers
    const sortableHeaders = document.querySelectorAll('.sortable-header');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortField = header.getAttribute('data-sort');
            const type = header.getAttribute('data-type');
            const state = type === 'songs' ? songsState : usersState;

            // Update UI
            document.querySelectorAll(`.sortable-header[data-type="${type}"]`).forEach(h => h.classList.remove('sorted-column'));
            header.classList.add('sorted-column');

            state.sortField = sortField;
            renderTable(type);
        });
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

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

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

let songsState = {
    all: [],
    filtered: null,
    searchQuery: '',
    currentCount: 0,
    batchSize: 50,
    sortField: null,
    tbodySelector: '#global-songs-table tbody',
    showMoreContainerId: 'show-more-songs-container',
    createRowFn: createSongRow
};

let usersState = {
    all: [],
    filtered: null,
    searchQuery: '',
    currentCount: 0,
    batchSize: 50,
    sortField: null,
    tbodySelector: '#users-tbody',
    showMoreContainerId: 'show-more-container',
    createRowFn: createUserRow
};

let allGlobalSongs = [];
let allUsers = [];

function sortData(dataset, sortField) {
    if (!sortField) return dataset;
    return [...dataset].sort((a, b) => {
        const valA = a[sortField] || 0;
        const valB = b[sortField] || 0;
        return valB - valA;
    });
}

function renderTable(type) {
    const isSongs = type === 'songs';
    const state = isSongs ? songsState : usersState;
    const activeData = state.filtered !== null ? state.filtered : state.all;
    const tbody = document.querySelector(state.tbodySelector);
    const showMoreContainer = document.getElementById(state.showMoreContainerId);
    if (!tbody) return;

    tbody.innerHTML = '';

    if (activeData.length === 0) {
        const tr = document.createElement('tr');
        const emptyMsg = state.searchQuery 
            ? `No ${isSongs ? 'songs' : 'users'} found matching "${escapeHtml(state.searchQuery)}".`
            : `No ${isSongs ? 'songs' : 'users'} found.`;
        tr.innerHTML = `<td colspan="4" class="empty-state">${emptyMsg}</td>`;
        tbody.appendChild(tr);
        if (showMoreContainer) showMoreContainer.style.display = 'none';
        return;
    }

    let dataToRender = activeData;
    if (state.sortField) {
        dataToRender = sortData(dataToRender, state.sortField);
    }

    const countToRender = Math.min(state.currentCount, dataToRender.length);
    const visibleData = dataToRender.slice(0, countToRender);

    const fragment = document.createDocumentFragment();
    visibleData.forEach(item => {
        fragment.appendChild(state.createRowFn(item, item.originalRank));
    });
    tbody.appendChild(fragment);

    if (showMoreContainer) {
        showMoreContainer.style.display = countToRender >= dataToRender.length ? 'none' : 'block';
    }
}

function renderMore(type) {
    const isSongs = type === 'songs';
    const state = isSongs ? songsState : usersState;
    const activeData = state.filtered !== null ? state.filtered : state.all;

    const nextBatchLength = Math.min(state.batchSize, activeData.length - state.currentCount);
    if (nextBatchLength > 0) {
        state.currentCount += nextBatchLength;
        renderTable(type);
    }
}

function handleSearch(rawQuery, type) {
    const isSongs = type === 'songs';
    const state = isSongs ? songsState : usersState;
    const searchField = isSongs ? 'title' : 'username';

    state.searchQuery = (rawQuery || '').trim();

    if (state.searchQuery.length > 0) {
        const parsedQuery = parseSearchQuery(state.searchQuery);
        state.filtered = state.all.filter(item => {
            const val = item[searchField];
            if (!val) return false;
            const text = val.toLowerCase();

            if (parsedQuery.type === 'exact_phrase') {
                return text.includes(parsedQuery.term.toLowerCase());
            } else if (parsedQuery.type === 'whole_fuzzy') {
                return fuzzyMatch(parsedQuery.term, text);
            } else {
                for (let termObj of parsedQuery.terms) {
                    if (termObj.type === 'exact') {
                        if (!text.includes(termObj.term.toLowerCase())) return false;
                    } else if (termObj.type === 'fuzzy') {
                        if (!fuzzyMatch(termObj.term, text)) return false;
                    }
                }
                return true;
            }
        });
    } else {
        state.filtered = null;
    }

    const totalAvailable = state.filtered !== null ? state.filtered.length : state.all.length;
    state.currentCount = Math.min(state.batchSize, totalAvailable);
    renderTable(type);
}

function renderData(data) {
    if (data.lastUpdated) {
        document.getElementById('last-updated').textContent = `Last updated: ${new Date(data.lastUpdated).toLocaleString('en-US', { timeZone: 'America/Chicago', timeZoneName: 'short' })}`;
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
    songsState.all = allGlobalSongs;
    songsState.filtered = null;
    songsState.searchQuery = '';
    songsState.currentCount = Math.min(songsState.batchSize, songsState.all.length);
    renderTable('songs');

    // Setup Users
    allUsers = data.stats.users.map((user, idx) => ({...user, originalRank: idx + 1}));
    usersState.all = allUsers;
    usersState.filtered = null;
    usersState.searchQuery = '';
    usersState.currentCount = Math.min(usersState.batchSize, usersState.all.length);
    renderTable('users');
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
    const showMoreContainer = document.getElementById('show-more-container');

    const nextBatchLength = Math.min(BATCH_SIZE, allUsers.length - currentDisplayCount);
    if (nextBatchLength > 0) {
        currentDisplayCount += nextBatchLength;
        reRenderTable(allUsers, currentDisplayCount, currentSortUsers, '#users-tbody', createUserRow);
    }

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

function parseSearchQuery(query) {
    query = query.trim();
    if (query.startsWith('*"') && query.endsWith('"*') && query.length >= 4) {
        return { type: 'whole_fuzzy', term: query.slice(2, -2) };
    }
    if (query.startsWith('"') && query.endsWith('"') && query.length >= 2) {
        return { type: 'exact_phrase', term: query.slice(1, -1) };
    }

    let isGlobalFuzzy = false;
    if (query.startsWith('*') && query.endsWith('*') && query.length >= 2) {
        isGlobalFuzzy = true;
        query = query.slice(1, -1);
    }

    const words = query.split(/\s+/).filter(w => w.length > 0);
    const terms = words.map(word => {
        let isFuzzy = isGlobalFuzzy;
        let w = word;

        if (!isGlobalFuzzy && w.startsWith('*') && w.endsWith('*') && w.length >= 2) {
            isFuzzy = true;
            w = w.slice(1, -1);
        }

        return { type: isFuzzy ? 'fuzzy' : 'exact', term: w };
    });

    return { type: 'words', terms: terms };
}

function fuzzyMatch(pattern, text) {
    if (pattern.length === 0) return true;
    if (text.length === 0) return false;

    pattern = pattern.toLowerCase();
    text = text.toLowerCase();

    let maxErrors = 0;
    if (pattern.length <= 3) maxErrors = 0;
    else if (pattern.length <= 5) maxErrors = 1;
    else maxErrors = 2;

    const m = pattern.length;
    const n = text.length;

    let dp1 = new Array(m + 1).fill(0).map((_, i) => i);

    let minGlobalError = m;

    for (let j = 1; j <= n; j++) {
        let nextDp = new Array(m + 1).fill(0);
        nextDp[0] = 0;

        for (let i = 1; i <= m; i++) {
            let cost = (pattern[i - 1] === text[j - 1]) ? 0 : 1;
            nextDp[i] = Math.min(
                dp1[i] + 1,       // Deletion
                nextDp[i - 1] + 1, // Insertion
                dp1[i - 1] + cost   // Substitution
            );
        }
        dp1 = nextDp;
        minGlobalError = Math.min(minGlobalError, dp1[m]);
        if (minGlobalError <= maxErrors) return true;
    }

    return minGlobalError <= maxErrors;
}

function setupColorChooser() {
    const bubbles = document.querySelectorAll('.color-bubble');
    if (!bubbles.length) return;

    // Load saved color or default to #C41D48
    const savedColor = localStorage.getItem('preferredAccentColor') || '#C41D48';

    function setAccentColor(color, hoverColor) {
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-hover', hoverColor);

        bubbles.forEach(bubble => {
            const bColor = bubble.getAttribute('data-color');
            bubble.style.backgroundColor = bColor;
            if (bColor.toLowerCase() === color.toLowerCase()) {
                bubble.classList.add('active');
            } else {
                bubble.classList.remove('active');
            }
        });
    }

    // Find initial matching bubble or default to first
    let initialBubble = Array.from(bubbles).find(b => b.getAttribute('data-color').toLowerCase() === savedColor.toLowerCase()) || bubbles[0];
    setAccentColor(initialBubble.getAttribute('data-color'), initialBubble.getAttribute('data-hover'));

    bubbles.forEach(bubble => {
        bubble.addEventListener('click', () => {
            const color = bubble.getAttribute('data-color');
            const hover = bubble.getAttribute('data-hover');
            setAccentColor(color, hover);
            localStorage.setItem('preferredAccentColor', color);
        });
    });
}
