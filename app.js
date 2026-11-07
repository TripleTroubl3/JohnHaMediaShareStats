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
                closeModal(modal);
            });
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === userModal || event.target === songModal) {
            closeModal(event.target);
        }
        if (!event.target.closest('.message-badge')) {
            document.querySelectorAll('.message-badge.active').forEach(b => b.classList.remove('active'));
        }
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllModals();
        }
    });

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            switchTab(targetId);
            updateUrlHash({ tab: targetId.replace('tab-', '') });
        });
    });

    window.addEventListener('hashchange', () => {
        applyUrlRouting();
    });

    // Timeframe selector logic
    const timeframeBtns = document.querySelectorAll('.timeframe-btn');
    timeframeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tf = btn.getAttribute('data-timeframe');
            setTimeframe(tf, true);
        });
    });

    // Sorting logic for headers
    const sortableHeaders = document.querySelectorAll('.sortable-header');
    sortableHeaders.forEach(header => {
        const onHeaderClick = () => {
            const sortField = header.getAttribute('data-sort');
            const type = header.getAttribute('data-type');
            const state = type === 'songs' ? songsState : usersState;

            if (state.sortField === sortField) {
                state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
            } else {
                state.sortField = sortField;
                state.sortDirection = (sortField === 'title' || sortField === 'username' || sortField === 'originalRank') ? 'asc' : 'desc';
            }

            updateSortHeaders(type);
            renderTable(type);
        };

        header.addEventListener('click', onHeaderClick);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onHeaderClick();
            }
        });
    });
}

function updateSortHeaders(type) {
    const state = type === 'songs' ? songsState : usersState;
    const headers = document.querySelectorAll(`.sortable-header[data-type="${type}"]`);

    headers.forEach(header => {
        const field = header.getAttribute('data-sort');
        const icon = header.querySelector('.sort-icon');
        const isCurrent = (field === state.sortField);

        if (isCurrent) {
            header.classList.add('sorted-column');
            header.setAttribute('aria-sort', state.sortDirection === 'asc' ? 'ascending' : 'descending');
            if (icon) {
                icon.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
            }
        } else {
            header.classList.remove('sorted-column');
            header.setAttribute('aria-sort', 'none');
            if (icon) {
                icon.textContent = '⇅';
            }
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
    sortField: 'count',
    sortDirection: 'desc',
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
    sortField: 'totalRequests',
    sortDirection: 'desc',
    tbodySelector: '#users-tbody',
    showMoreContainerId: 'show-more-container',
    createRowFn: createUserRow
};

let allGlobalSongs = [];
let allUsers = [];

function sortData(dataset, sortField, sortDirection = 'desc') {
    if (!sortField) return dataset;
    return [...dataset].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
            const cmp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
            return sortDirection === 'asc' ? cmp : -cmp;
        }

        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
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
        dataToRender = sortData(dataToRender, state.sortField, state.sortDirection);
    }

    const countToRender = Math.min(state.currentCount, dataToRender.length);
    const visibleData = dataToRender.slice(0, countToRender);

    const isRankSorted = state.sortField === 'originalRank' || (!state.sortField && state.filtered === null);
    const fragment = document.createDocumentFragment();
    visibleData.forEach((item, index) => {
        const displayRank = isRankSorted 
            ? item.originalRank 
            : `<span title="All-time rank: #${item.originalRank}">${index + 1}</span>`;
        fragment.appendChild(state.createRowFn(item, displayRank));
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

let globalData = null;
let currentTimeframe = 'all';

function setTimeframe(tf, updateHash = true) {
    if (!globalData) return;
    currentTimeframe = tf || 'all';

    document.querySelectorAll('.timeframe-btn').forEach(b => {
        if (b.getAttribute('data-timeframe') === currentTimeframe) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    if (updateHash) {
        updateUrlHash({ timeframe: currentTimeframe === 'all' ? null : currentTimeframe });
    }

    const stats = (globalData.timeframes && globalData.timeframes[currentTimeframe]) 
        ? globalData.timeframes[currentTimeframe] 
        : globalData.stats;
    applyStats(stats);
}

function applyStats(stats) {
    if (!stats) return;

    // Render Global Stats
    const globalTotal = document.getElementById('global-total-time');
    if (globalTotal && stats.global) {
        globalTotal.textContent = formatTime(stats.global.totalSeconds);
    }

    const globalRequests = document.getElementById('global-total-requests');
    if (globalRequests && stats.global && stats.global.totalRequests !== undefined) {
        globalRequests.textContent = stats.global.totalRequests.toLocaleString();
    }

    // Setup Global Songs
    allGlobalSongs = (stats.global && stats.global.topSongs ? stats.global.topSongs : []).map((song, idx) => ({...song, originalRank: idx + 1}));
    songsState.all = allGlobalSongs;
    if (songsState.searchQuery) {
        handleSearch(songsState.searchQuery, 'songs');
    } else {
        songsState.filtered = null;
        songsState.currentCount = Math.min(songsState.batchSize, songsState.all.length);
        renderTable('songs');
    }

    // Setup Users
    allUsers = (stats.users || []).map((user, idx) => ({...user, originalRank: idx + 1}));
    usersState.all = allUsers;
    if (usersState.searchQuery) {
        handleSearch(usersState.searchQuery, 'users');
    } else {
        usersState.filtered = null;
        usersState.currentCount = Math.min(usersState.batchSize, usersState.all.length);
        renderTable('users');
    }

    buildSongUsersIndex();
}

function renderData(data) {
    globalData = data;

    if (data.lastUpdated) {
        document.getElementById('last-updated').textContent = `Last updated: ${new Date(data.lastUpdated).toLocaleString('en-US', { timeZone: 'America/Chicago', timeZoneName: 'short' })}`;
    }

    setTimeframe(currentTimeframe, false);

    // Setup Recent Requests
    allRecentRequests = data.recentRequests || [];
    renderRecentRequests(allRecentRequests);

    applyUrlRouting();
}

let allRecentRequests = [];

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function createRecentRow(item, index) {
    const tr = document.createElement('tr');
    const exactDate = new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' });
    const relTime = formatRelativeTime(item.createdAt);
    const msgEscaped = item.message ? escapeHtml(item.message) : '';
    const msgDisplay = item.message ? `<span class="recent-msg" title="${msgEscaped}">"${msgEscaped}"</span>` : '<span style="color:#666;">—</span>';

    tr.innerHTML = `
        <td>${index + 1}</td>
        <td class="recent-time" title="${exactDate}">${relTime}</td>
        <td><a href="https://youtu.be/${escapeHtml(item.videoId)}" target="_blank" rel="noopener noreferrer" class="song-link">${escapeHtml(item.title)}</a></td>
        <td><button class="link-btn user-link" type="button">${escapeHtml(item.username)}</button></td>
        <td>${formatTime(item.duration)}</td>
        <td>${msgDisplay}</td>
    `;

    tr.addEventListener('click', (e) => {
        if (e.target.closest('a.song-link')) return;
        if (e.target.closest('.user-link')) {
            const userObj = allUsers.find(u => u.username.toLowerCase() === item.username.toLowerCase());
            if (userObj) openUserModal(userObj);
            return;
        }
        const songObj = allGlobalSongs.find(s => s.videoId === item.videoId) || {
            videoId: item.videoId,
            title: item.title,
            count: 1,
            totalSeconds: item.duration
        };
        openSongModal(songObj);
    });

    return tr;
}

function renderRecentRequests(items) {
    const tbody = document.getElementById('recent-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent requests recorded.</td></tr>';
        return;
    }
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
        fragment.appendChild(createRecentRow(item, index));
    });
    tbody.appendChild(fragment);
}

let songUsersIndex = new Map();

function buildSongUsersIndex() {
    songUsersIndex.clear();
    allUsers.forEach(user => {
        (user.topSongs || []).forEach(userSong => {
            if (!songUsersIndex.has(userSong.videoId)) {
                songUsersIndex.set(userSong.videoId, []);
            }
            songUsersIndex.get(userSong.videoId).push({
                username: user.username,
                count: userSong.count,
                totalSeconds: userSong.totalSeconds
            });
        });
    });
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
    const searchInput = document.getElementById('modal-user-search');

    modalUsername.textContent = `${user.username}'s Top Requested Songs`;
    modalUserTotal.textContent = `Total Requests: ${user.totalRequests || 0} | Total Time: ${formatTime(user.totalSeconds)}`;

    const getTooltipHtml = (videoId) => {
        if (!user.messages) return '';
        const relevantMessages = user.messages.filter(m => m.videoId === videoId);
        if (relevantMessages.length === 0) return '';

        const uniqueMessages = [...new Set(relevantMessages.map(m => m.message))];
        const messagesList = uniqueMessages.map(m => `"${escapeHtml(m)}"`).join('<br>');

        return `<button type="button" class="message-badge" aria-label="Attached request messages" title="View attached messages">💬<span class="tooltip"><strong>Attached Messages:</strong><br>${messagesList}</span></button>`;
    };

    const songs = user.topSongs || [];

    function renderUserSongs(query = '') {
        modalSongsContainer.innerHTML = '';
        const q = query.trim().toLowerCase();
        const filtered = q ? songs.filter(s => (s.title || '').toLowerCase().includes(q)) : songs;

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Song</th>
                    <th>Requests</th>
                    <th>Total Time</th>
                </tr>
            </thead>
        `;
        const tbody = document.createElement('tbody');

        if (filtered.length > 0) {
            filtered.forEach(song => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <a href="https://youtu.be/${escapeHtml(song.videoId)}" target="_blank" rel="noopener noreferrer" class="song-link">${escapeHtml(song.title)}</a>
                        ${getTooltipHtml(song.videoId)}
                    </td>
                    <td>${song.count}</td>
                    <td>${formatTime(song.totalSeconds)}</td>
                `;
                tr.title = `Click row to view all requests for "${song.title}"`;
                tr.addEventListener('click', (e) => {
                    const badge = e.target.closest('.message-badge');
                    if (badge) {
                        e.stopPropagation();
                        const wasActive = badge.classList.contains('active');
                        document.querySelectorAll('.message-badge.active').forEach(b => b.classList.remove('active'));
                        if (!wasActive) {
                            badge.classList.add('active');
                        }
                        return;
                    }
                    if (!e.target.closest('a.song-link')) {
                        const songObj = allGlobalSongs.find(s => s.videoId === song.videoId) || {
                            videoId: song.videoId,
                            title: song.title,
                            count: song.count,
                            totalSeconds: song.totalSeconds
                        };
                        openSongModal(songObj);
                    }
                });
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" class="empty-state">No songs found matching "${escapeHtml(query)}".</td>`;
            tbody.appendChild(tr);
        }

        table.appendChild(tbody);
        modalSongsContainer.appendChild(table);
    }

    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = (e) => renderUserSongs(e.target.value);
        searchInput.onsearch = (e) => renderUserSongs(e.target.value);
    }

    renderUserSongs('');
    openModal(modal);
    updateUrlHash({ user: user.username, song: null });
}

function openSongModal(song) {
    const modal = document.getElementById('song-modal');
    const modalTitle = document.getElementById('modal-song-title');
    const modalTotal = document.getElementById('modal-song-total');
    const modalContainer = document.getElementById('modal-song-users-container');

    modalTitle.textContent = `Users who requested "${song.title}"`;
    modalTotal.textContent = `Total Requests: ${song.count} | Total Time: ${formatTime(song.totalSeconds)}`;

    let songUsers = song.users;

    if (!songUsers) {
        const found = songUsersIndex.get(song.videoId) || [];
        songUsers = found.slice().sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds);
        song.users = songUsers;
    }

    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Rank</th>
                <th>Username</th>
                <th>Requests</th>
                <th>Total Time</th>
            </tr>
        </thead>
    `;
    const tbody = document.createElement('tbody');

    if (songUsers && songUsers.length > 0) {
        songUsers.forEach((u, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><button class="link-btn user-link" type="button">${escapeHtml(u.username)}</button></td>
                <td>${u.count}</td>
                <td>${formatTime(u.totalSeconds)}</td>
            `;
            tr.title = `Click to view ${u.username}'s request history`;
            tr.addEventListener('click', () => {
                const userObj = allUsers.find(item => item.username.toLowerCase() === u.username.toLowerCase());
                if (userObj) {
                    openUserModal(userObj);
                }
            });
            tbody.appendChild(tr);
        });
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" class="empty-state">No users found.</td>`;
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    modalContainer.innerHTML = '';
    modalContainer.appendChild(table);

    openModal(modal);
    updateUrlHash({ song: song.videoId, user: null });
}

function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) closeBtn.focus();
}

function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    const anyOpen = document.querySelector('.modal[style*="display: block"]');
    if (!anyOpen) {
        document.body.classList.remove('modal-open');
        updateUrlHash({ user: null, song: null });
    }
}

function closeAllModals() {
    const modals = [document.getElementById('user-modal'), document.getElementById('song-modal')];
    modals.forEach(m => {
        if (m) m.style.display = 'none';
    });
    document.body.classList.remove('modal-open');
    updateUrlHash({ user: null, song: null });
}

function switchTab(tabId) {
    const targetId = tabId.startsWith('tab-') ? tabId : `tab-${tabId}`;
    const btn = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
    if (btn) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
    }
}

function parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash) {
        if (hash.includes('=')) {
            const hashParams = new URLSearchParams(hash);
            hashParams.forEach((val, key) => params.set(key, val));
        } else if (['songs', 'users', 'recent'].includes(hash)) {
            params.set('tab', hash);
        }
    }
    return params;
}

function updateUrlHash(changes) {
    const currentParams = parseUrlParams();
    Object.entries(changes).forEach(([key, val]) => {
        if (val === null || val === undefined || val === '') {
            currentParams.delete(key);
        } else {
            currentParams.set(key, val);
        }
    });

    const hashStr = currentParams.toString();
    const newUrl = hashStr ? `#${hashStr}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
}

function applyUrlRouting() {
    if (!globalData) return;
    const params = parseUrlParams();

    if (params.has('timeframe')) {
        const tf = params.get('timeframe');
        if (['all', '30d', '90d', 'year'].includes(tf)) {
            setTimeframe(tf, false);
        }
    }

    if (params.has('tab')) {
        switchTab(params.get('tab'));
    }

    if (params.has('user')) {
        const username = params.get('user');
        const userObj = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (userObj) {
            switchTab('users');
            openUserModal(userObj);
        }
    } else if (params.has('song')) {
        const videoId = params.get('song');
        const songObj = allGlobalSongs.find(s => s.videoId === videoId) || {
            videoId: videoId,
            title: videoId,
            count: 1,
            totalSeconds: 0
        };
        switchTab('songs');
        openSongModal(songObj);
    }
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
