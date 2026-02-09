// 1. 初始化點擊觸發 (只負責產生年份按鈕)
document.getElementById('ncu-league-trigger').addEventListener('click', async function () {
    const yearButtonContainer = document.getElementById('year-button');
    if (!yearButtonContainer) return;

    try {
        const response = await fetch('/api/available-years');
        const years = await response.json();

        // 產生年份按鈕，確保 data-year 存入的是純數字/字串
        const yearButtons = years.map((y, index) => `
            <button class="year-btn ${index === 0 ? 'active' : ''}" data-year="${y.year}">
                ${y.year}
            </button>
        `).join('');

        yearButtonContainer.innerHTML = `
            <div class="year-menu">${yearButtons}</div>
            <div id="team-grid-container" class="category-grid"></div>
        `;

        // 初始載入：統一傳入「純年份值」
        if (years.length > 0) {
            loadLevelData(years[0].year);
        }
    } catch (error) {
        console.error('抓取年份按鈕失敗:', error);
    }
});

// 2. 獨立出來的事件代理 (避免重複掛載監聽器)
document.addEventListener('click', function (e) {
    // 處理年份按鈕
    if (e.target.classList.contains('year-btn')) {
        document.querySelectorAll('.year-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        const selectedYear = e.target.getAttribute('data-year');
        loadLevelData(selectedYear); // 這裡傳入的是字串

        const searchArea = document.getElementById('game-search-area');
        searchArea.innerHTML = ''; // 清空搜尋區域
        const rankArea = document.getElementById('ranking-search-area');
        rankArea.innerHTML = ''; // 清空排名區域
        return;
    }

    // 處理 Level 選擇 (Junior/Major...)
    const levelBtn = e.target.closest('.level-select');
    if (levelBtn) {
        const selectedYear = levelBtn.getAttribute('data-year');
        const selectedLevel = levelBtn.getAttribute('data-level');
        loadTeamData(selectedYear, selectedLevel);
    }
});

// 3. 顯示四組分類的函式
async function loadLevelData(yearValue) {
    const contentArea = document.getElementById('dynamic-content-area');
    if (!contentArea) return;

    // 統一使用 yearValue，因為它現在保證是純年份 (數字或字串)
    const newContent = `
        <div class="category-grid">
            <div class="category-card">
                <img src="images/Junior.jpg" alt="Junior">
                <a href="javascript:void(0)" class="level-select" data-year="${yearValue}" data-level="J"><h3>Junior</h3></a>
                <p>U15青少棒 (國中)</p>
            </div>
            <div class="category-card">
                <img src="images/Major.jpg" alt="Major">
                <a href="javascript:void(0)" class="level-select" data-year="${yearValue}" data-level="Major"><h3>Major</h3></a>
                <p>U12少棒 (國小五、六年級為主)</p>
            </div>
            <div class="category-card">
                <img src="images/Minor.jpg" alt="Minor">
                <a href="javascript:void(0)" class="level-select" data-year="${yearValue}" data-level="Minor"><h3>Minor</h3></a>
                <p>U10少棒 (國小三、四年級為主)</p>
            </div>
            <div class="category-card">
                <img src="images/U8.jpg" alt="U8">
                <a href="javascript:void(0)" class="level-select" data-year="${yearValue}" data-level="U8"><h3>U8</h3></a>
                <p>U8少棒 (大班~小二)</p>
            </div>
        </div>
    `;
    contentArea.innerHTML = newContent;
}

// 4. 最後的球隊資料載入
async function loadTeamData(year, level) {
    const contentArea = document.getElementById('dynamic-content-area');
    const searchArea = document.getElementById('game-search-area');
    const rankArea = document.getElementById('ranking-search-area');
    if (!contentArea) return;

    try {
        const response = await fetch(`/api/search-team?keyword=&year=${encodeURIComponent(year)}&level=${encodeURIComponent(level)}`);
        const teams = await response.json();

        if (teams.length === 0) {
            contentArea.innerHTML = `<p style="text-align:center; padding:50px;">${year} 年 ${level} 組暫無球隊資料</p>`;
            return;
        }

        const teamCardsHtml = teams.map(team => `
            <div class="team-card" data-team-id="${team.team_id}">
                <div class="team-card-image">
                    <img src="images/teams/${year}/${year}${level}${team.team_code}Icon.jpg" alt="${team.team_name}">
                </div>
                <div class="team-card-content">
                    <h3>${level}${team.team_code} ${team.team_name}</h3>
                    <div class="accordion">
                        <div class="accordion-item" data-type="info">
                            <button class="accordion-header">團練資訊 <span class="arrow">∨</span></button>
                            <div class="accordion-body">
                                <p>團練時段：${team.group_time || '未提供'}@${team.group_place || '未提供'}<br>
                                    晚練時段：${team.night_time || '未提供'}@${team.night_place || '未提供'}<br>
                                    雨備時段：${team.rain_time || '未提供'}@${team.rain_place || '未提供'}<br>
                                </p>
                            </div>
                        </div>
                        <div class="accordion-item" data-type="staff">
                            <button class="accordion-header">教練群 <span class="arrow">∨</span></button>
                            <div class="accordion-body">讀取中...</div>
                        </div>
                        <div class="accordion-item" data-type="players">
                            <button class="accordion-header">球員列表 <span class="arrow">∨</span></button>
                            <div class="accordion-body">讀取中...</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        contentArea.innerHTML = `
            <h2 class="level-title">${level} 隊組介紹</h2>
            <div class="team-grid">${teamCardsHtml}</div>
            <hr class="divider" style="margin: 40px 0; border: 0; border-top: 1px solid #ddd;">
            `;

        contentArea.scrollIntoView({ behavior: 'smooth' });

        searchArea.innerHTML = `
            <section class="search-card game-specific-card">
                <h3>📅 賽事查詢</h3>
                <div class="filter-group">
                    <div style="display: flex; gap: 10px;">
                        <select id="seasonGameSearch" "></select>
                        <select id="levelGameSearch"">
                        </select>
                    </div>
                </div>
                <div class="search-group">
                    <select id="selectGameSearch" ">
                        <option value="">-- 所有隊伍 --</option>
                    </select>
                    <button id="btnGameSearch" onclick="handleSearchGame()" class="btn-search">查詢賽事</button>
                    <button type="button" class="btn-clear"
                    onclick="document.getElementById('gameSectionOnly').style.display='none'">清除結果</button>
                    </div>
            </section>
            <section id="gameSectionOnly" class="result-section game-card" style="display:none;">
            <div class="section-header game-theme">
                <div class="header-content">
                    <span class="icon">📅</span>
                    <span class="title">賽程表</span>
                </div>
            </div>

            <div class="table-responsive">
                <table class="data-table game-table">
                    <thead>
                        <tr>
                            <th>賽季</th>
                            <th>場序</th>
                            <th>層級</th>
                            <th class="col-wide">比賽日期/地點</th>
                            <th>比賽時間</th>
                            <th>主審</th>
                            <th>壘審</th>
                            <th>賽別</th>
                            <th class="col-team">先攻隊伍</th>
                            <th class="col-score">得分</th>
                            <th>積分</th>
                            <th class="col-team">後攻隊伍</th>
                            <th class="col-score">得分</th>
                            <th>積分</th>
                            <th>組別</th>
                            <th>結果</th>
                        </tr>
                    </thead>
                    <tbody id="gameBodyOnly">
                    </tbody>
                </table>
            </div>
        </section>
        `;

        rankArea.innerHTML = `<!-- 賽事排名排行榜 -->
        <section class="search-card game-specific-card">
            <h3>🏆 賽事排名排行榜</h3>
            <div class="filter-group">
                <label class="search-hint">設定年份、層級與賽季 (必填)</label>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <select id="seasonRank" style="width: 140px;">
                        <option value="">-- 選擇賽季 --</option>
                    </select>
                    <select id="roundRank" style="width: 140px;">
                        <option value="">-- 選擇賽別 --</option>
                    </select>
                    <select id="levelRank" style="width: 140px;">
                        <option value="">-- 選擇層級 --</option>
                    </select>
                    <select id="groupRank" style="width: 140px;">
                        <option value="">-- 選擇組別 --</option>
                    </select>
                </div>
            </div>
            <div class="search-group">
                <button onclick="handleSearchStandings()" class="btn-search">產出排行榜</button>
                <button type="button" class="btn-clear"
                    onclick="document.getElementById('rankSection').style.display='none'">清除結果</button>
            </div>
        </section>

        <!-- 賽事排名排行榜 -->
        <section id="rankSection" class="result-section" style="display:none;">
            <div class="section-header search-theme" style="background-color: #f39c12; color: white;">
                <span id="rankTitle">🏆 賽事排名結果</span>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>名次</th>
                            <th>球隊名稱</th>
                            <th>已賽場數</th>
                            <th>總積分</th>
                            <th>總失分 (比序1)</th>
                            <th>總得分 (比序2)</th>
                            <th>組別</th>
                        </tr>
                    </thead>
                    <tbody id="rankBody"></tbody>
                </table>
            </div>
        </section>
        `;

        initSearchOptions(year, level);

    } catch (error) {
        console.error('載入球隊資料失敗:', error);
    }
}

document.addEventListener('click', async function (e) {
    const header = e.target.closest('.accordion-header');
    if (!header) return;

    const item = header.parentElement;
    const type = item.getAttribute('data-type');
    const card = item.closest('.team-card');
    const teamId = card.getAttribute('data-team-id');
    const body = item.querySelector('.accordion-body');

    // 切換展開狀態
    item.classList.toggle('active');

    // 如果是展開且內容尚未載入過，則向 API 請求資料
    if (item.classList.contains('active') && body.dataset.loaded !== 'true') {
        try {
            if (type === 'staff') {
                // 呼叫 2-3 API：取得教練群
                const res = await fetch(`/api/team-inrole?team_id=${teamId}`);
                const staff = await res.json();
                body.innerHTML = '<p>' + staff.map(s => `• ${s.role}: ${s.nickname}`).join('<br>') || '暫無資訊' + '</p>';
            }
            else if (type === 'players') {
                // 呼叫 2-2 API：取得球員列表
                const res = await fetch(`/api/team-player?team_id=${teamId}`);
                const players = await res.json();
                body.innerHTML = `
                    <table class="player-table">
                        <tr><th>背號</th><th>姓名</th><th>年級</th></tr>
                        ${players.map(p => `<tr><td>${p.jersey_number || '-'}</td><td>${p.nickname}</td><td>${p.grade}</td></tr>`).join('')}
                    </table>`;
            }
            body.dataset.loaded = 'true'; // 標記已載入，避免重複請求
        } catch (err) {
            body.innerHTML = '載入失敗';
        }
    }
});

/* ==========================================================================
    賽程搜尋功能
    ========================================================================== */
async function initSearchOptions(selectedYear, selectedLevel) {
    const seasonGameSelect = document.getElementById('seasonGameSearch');
    const seasonRankSelect = document.getElementById('seasonRank');
    let defaultSeason = seasonGameSelect.value;

    if (!seasonGameSelect || !seasonRankSelect) return;

    try {
        const res = await fetch('/api/season');
        const season = await res.json();
        seasonGameSelect.innerHTML = '<option value="">-- 所有賽季 --</option>' +
            season.map(s => `<option value="${s}">${seasonExpend(s)}</option>`).join('');

        seasonRankSelect.innerHTML = '<option value="">-- 選擇賽季 --</option>' +
            season.map(s => `<option value="${s}">${seasonExpend(s)}</option>`).join('');
        for (const s of season) {
            if (s.startsWith(selectedYear)) {
                seasonGameSelect.value = s; // 若有符合年份的賽季，則選擇該賽季
                seasonRankSelect.value = s; // 若有符合年份的賽季，則選擇該賽季
                defaultSeason = s;
                break;
            }
        }
    } catch (err) {
        console.error("初始化賽季失敗:", err);
    }
    const levelGameSelect = document.getElementById('levelGameSearch');
    const seasonLevelRankSelect = document.getElementById('levelRank');

    if (!seasonLevelRankSelect || !levelGameSelect) return;

    try {
        const res = await fetch('/api/game-level');
        const level = await res.json();
        levelGameSelect.innerHTML = '<option value="">-- 所有層級 --</option>' +
            level.map(l => `<option value="${l}">${l}</option>`).join('');
        levelGameSelect.value = selectedLevel; // 預設選擇目前隊伍的層級

        seasonLevelRankSelect.innerHTML = '<option value="">-- 選擇層級 --</option>' +
            level.map(l => `<option value="${l}">${l}</option>`).join('');
        seasonLevelRankSelect.value = selectedLevel; // 預設選擇目前隊伍的層級

        handleSearchGame(); // 初始載入賽程
    } catch (err) {
        console.error("初始化層級失敗:", err);
    }

    const roundRankSelect = document.getElementById('roundRank');;

    if (!roundRankSelect) return;
    try {
        const res = await fetch(`/api/round?season=${encodeURIComponent(defaultSeason)}`);
        const rounds = await res.json();
        roundRankSelect.innerHTML = '<option value="">-- 選擇賽別 --</option>' +
            rounds.map(r => `<option value="${r.round}">${r.round}</option>`).join('');
        roundRankSelect.value = rounds[0].round; // 預設選擇第一個賽別

        handleSearchStandings(); // 初始載入排名
    } catch (err) {
        console.error("初始化賽別失敗:", err);
    }
}

// 使用事件代理處理下拉選單的連動
document.addEventListener('click', function (e) {
    if (e.target.id === 'seasonGameSearch' || e.target.id === 'levelGameSearch') {
        updateTeamFromSeasonOptions();
    }
});

async function clearGameOptions() {
    const level = document.getElementById('levelGameSearch');
    const selectTeam = document.getElementById('selectGameSearch');
}

async function updateTeamFromSeasonOptions() {

    const season = document.getElementById('seasonGameSearch').value;
    const level = document.getElementById('levelGameSearch').value;
    const selectTeam = document.getElementById('selectGameSearch');

    selectTeam.innerHTML = '<option value="">-- 所有隊伍 --</option>';

    try {
        const response = await fetch(`/api/team-by-season-level?season=${encodeURIComponent(season)}&level=${encodeURIComponent(level)}`);
        const teams = await response.json();
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.h_team_id;
            option.textContent = team.h_team_id;
            selectTeam.appendChild(option);
        });
    } catch (err) {
        console.error("無法取得賽別列表:", err);
    }
}

// 賽程搜尋
async function handleSearchGame() {
    const season = document.getElementById('seasonGameSearch').value;
    const level = document.getElementById('levelGameSearch').value;
    const keyword = document.getElementById('selectGameSearch').value;

    setSubmitting('btnGameSearch', true);
    try {
        const apiUrl = `/api/search-game?keyword=${encodeURIComponent(keyword)}&season=${encodeURIComponent(season)}&level=${encodeURIComponent(level)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.length === 0) {
            alert("查無賽程資料");
            return;
        }

        const body = document.getElementById('gameBodyOnly');
        const section = document.getElementById('gameSectionOnly');

        body.innerHTML = data.map(item => {
            const awayTeamName = item.g_team_id || '未知隊伍';
            const homeTeamName = item.h_team_id || '未知隊伍';

            const awayColorClass = (item.clothes == 1) ? 'team-red' : 'team-black';
            const homeColorClass = (item.clothes == 1) ? 'team-black' : 'team-red';
            const resultBtn = item.result_img
                ? `<button class="btn-view-img" onclick="showMatchResult('${item.result_img}')">計分表</button>`
                : `<span class="no-data">-</span>`;
            return `
        <tr>
            <td>${item.season}</td>
            <td>${item.serNo}</td>
            <td>${item.level}</td>
            <td class="col-wide">
    <div class="datetime-info">
        <span class="date-text">${item.date ? item.date.substring(0, 10) : '-'}</span>
        <br> <span class="place-tag">@${item.place || '-'}</span>
    </div>
            </td>
            <td class="time-range">
                ${item.from.slice(0, 5)} - ${item.to.slice(0, 5)}
            </td>
            <td>${item.head_umpire ?? "未指派"}</td>
            <td>${item.referee ?? "未指派"}</td>
            <td>${item.round}</td>
            <td class="col-team ${awayColorClass}">${awayTeamName}</td>
            <td class="col-score">${item.gScore ?? 0}</td>
            <td>${item.gPoint ?? 0}</td>
            <td class="col-team ${homeColorClass}">${homeTeamName}</td>
            <td class="col-score">${item.hScore ?? 0}</td>
            <td>${item.hPoint ?? 0}</td>
            <td>${item.group ?? '-'}</td>
            <td>${resultBtn}</td>
        </tr>
`}).join('');

        // 顯示結果並捲動到該區塊
        section.style.display = 'block';

    } catch (err) {
        alert("查詢失敗");
    } finally {
        setSubmitting('btnGameSearch', false);
    }
}

function seasonExpend(seasonStr) {

    if (seasonStr.includes("春季")) {
        return seasonStr + " (下半季)";
    }
    else if (seasonStr.includes("冬季")) {
        return seasonStr + " (上半季)";
    }
}

/* ==========================================================================
    賽事排名排行榜
    ========================================================================== */

document.addEventListener('change', function (e) {
    if (e.target.id === 'seasonRank') {
        // 變更賽季時，先更新賽別，後續會自動觸發層級更新
        updateRoundOptions();
    }
    if (e.target.id === 'roundRank') {
        // 變更賽別時，更新層級
        updateLevelOptions();
    }
    if (e.target.id === 'levelRank') {
        // 變更層級時，更新組別
        updateGroupOptions();
    }
});

async function updateRoundOptions() {
    const season = document.getElementById('seasonRank').value;
    const roundSelect = document.getElementById('roundRank');
    const levelSelect = document.getElementById('levelRank');

    if (!season) return;

    // 清空後續所有選單
    roundSelect.innerHTML = '<option value="">-- 讀取中 --</option>';
    levelSelect.innerHTML = '<option value="">-- 選擇層級 --</option>';

    try {
        const response = await fetch(`/api/round?season=${encodeURIComponent(season)}`);
        const rounds = await response.json();

        roundSelect.innerHTML = '<option value="">-- 選擇賽別 --</option>' +
            rounds.map(r => `<option value="${r.round}">${r.round}</option>`).join('');

        // 自動觸發：如果只有一個賽別或已有預設值，直接更新層級
        if (rounds.length > 0) {
            roundSelect.value = rounds[0].round;
            updateLevelOptions(); // 💡 關鍵：自動連動到下一層
        }
    } catch (err) {
        console.error("無法取得賽別列表:", err);
    }
}

async function updateLevelOptions() {
    const season = document.getElementById('seasonRank').value;
    const round = document.getElementById('roundRank').value;
    const levelSelect = document.getElementById('levelRank');

    if (!season || !round) {
        levelSelect.innerHTML = '<option value="">-- 選擇層級 --</option>';
        return;
    }

    levelSelect.innerHTML = '<option value="">-- 讀取中 --</option>';

    try {
        const response = await fetch(`/api/level-by-round?season=${encodeURIComponent(season)}&round=${encodeURIComponent(round)}`);
        const levels = await response.json();

        // 💡 這裡假設 level 是純字串陣列，如果是物件請改成 l.level
        levelSelect.innerHTML = '<option value="">-- 選擇層級 --</option>' +
            levels.map(l => {
                const val = (typeof l === 'object') ? l.level : l;
                return `<option value="${val}">${val}</option>`;
            }).join('');

    } catch (err) {
        console.error("無法取得層級列表:", err);
    }
}

async function updateGroupOptions() {
    const season = document.getElementById('seasonRank').value;
    const round = document.getElementById('roundRank').value;
    const level = document.getElementById('levelRank').value;
    const groupSelect = document.getElementById('groupRank');
    if (!season || !round || !level) {
        groupSelect.innerHTML = '<option value="">-- 選擇組別 --</option>';
        return;
    }
    groupSelect.innerHTML = '<option value="">-- 讀取中 --</option>';
    try {
        const response = await fetch(`/api/group-by-round-level?season=${encodeURIComponent(season)}&round=${encodeURIComponent(round)}&level=${encodeURIComponent(level)}`);
        const groups = await response.json();
        if (groups.length === 1 && groups[0] === null) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "無組別資料";
            groupSelect.appendChild(option);
            return;
        }
        groupSelect.innerHTML = '<option value="">-- 選擇組別 --</option>' +
            groups.map(g => {
                const val = (typeof g === 'object') ? g.group : g;
                return `<option value="${val}">${val}</option>`;
            }).join('');
    } catch (err) {
        console.error("無法取得組別列表:", err);
    }
}

async function handleSearchStandings() {
    const season = document.getElementById('seasonRank').value;
    const round = document.getElementById('roundRank').value;
    const level = document.getElementById('levelRank').value;
    const group = document.getElementById('groupRank').value;

    if (!round || !level || !season) {
        alert("請選擇賽別、層級與賽季以計算排名");
        return;
    }

    const body = document.getElementById('rankBody');
    const section = document.getElementById('rankSection');

    // 顯示 Loading
    body.innerHTML = '<tr><td colspan="6">📊 正在計算排名數據...</td></tr>';
    section.style.display = 'block';

    try {
        // 構建 URL
        let url = `/api/standings?season=${season}&round=${round}&level=${level}`;
        if (group) url += `&group=${encodeURIComponent(group)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            renderRankTable(result.data);
        } else {
            body.innerHTML = '<tr><td colspan="6">❌ 目前暫無比賽數據可計算排名</td></tr>';
        }
    } catch (err) {
        console.error("排名查詢失敗:", err);
        body.innerHTML = '<tr><td colspan="6">⚠️ 伺服器錯誤，無法計算</td></tr>';
    }
}

function renderRankTable(data) {
    const body = document.getElementById('rankBody');
    body.innerHTML = '';

    data.forEach((item, index) => {
        const tr = document.createElement('tr');

        // 根據名次給予特殊樣式 (前三名)
        let rankDisplay = index + 1;
        if (rankDisplay === 1) rankDisplay = '🥇 1';
        if (rankDisplay === 2) rankDisplay = '🥈 2';
        if (rankDisplay === 3) rankDisplay = '🥉 3';

        tr.innerHTML = `
            <td style="font-weight: bold;">${rankDisplay}</td>
            <td style="color: #2c3e50; font-weight: bold;">${item.team_name}</td>
            <td>${item.games_played}</td>
            <td style="color: blue; font-weight: bold;">${item.total_points}</td>
            <td style="color: red;">${item.total_runs_allowed}</td>
            <td style="color: green;">${item.total_runs_scored}</td>
            <td> ${item.group || '-'}</td>
        `;
        body.appendChild(tr);
    });
}


function setSubmitting(btnId, isSubmitting) {
    const btn = document.getElementById(btnId);
    btn.disabled = isSubmitting;
}

function showMatchResult(imgUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImg');
    modal.style.display = "block";
    modalImg.src = imgUrl; // 這裡 imgUrl 就是資料庫存的 /images/results/...
}

function closeModal() {
    document.getElementById('imageModal').style.display = "none";
}