/* ==========================================================================
    初始化下拉選單
   ========================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
    // 傳入所有需要顯示層級的選單 ID
    initializeLevelDropdowns(['levelTeamOnly']);
    initializeGameLevelDropdowns(['levelGameSearch']);
    initializeSeasonDropdowns(['seasonGameSearch', 'seasonRank']);
});

async function initializeLevelDropdowns(selectIds) {
    try {
        // 1. 只抓取一次資料，節省伺服器資源
        const response = await fetch('/api/level');
        const levels = await response.json();

        // 2. 遍歷每一個指定的 ID
        selectIds.forEach(id => {
            const selectElement = document.getElementById(id);
            if (!selectElement) return; // 如果找不到該 ID 就跳過

            // 3. 將層級資料填入該選單
            levels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                selectElement.appendChild(option);
            });
        });
    } catch (err) {
        console.error("層級選單初始化失敗:", err);
    }
}

async function initializeGameLevelDropdowns(selectIds) {
    try {
        // 1. 只抓取一次資料，節省伺服器資源
        const response = await fetch('/api/game-level');
        const levels = await response.json();

        // 2. 遍歷每一個指定的 ID
        selectIds.forEach(id => {
            const selectElement = document.getElementById(id);
            if (!selectElement) return; // 如果找不到該 ID 就跳過

            // 3. 將層級資料填入該選單
            levels.forEach(level => {
                const option = document.createElement('option');
                option.value = level;
                option.textContent = level;
                selectElement.appendChild(option);
            });
        });
    } catch (err) {
        console.error("層級選單初始化失敗:", err);
    }
}

async function initializeSeasonDropdowns(selectIds) {
    try {
        // 1. 只抓取一次資料，節省伺服器資源
        const response = await fetch('/api/season');
        const seasons = await response.json();

        // 2. 遍歷每一個指定的 ID
        selectIds.forEach(id => {
            const selectElement = document.getElementById(id);
            if (!selectElement) return; // 如果找不到該 ID 就跳過

            // 3. 將層級資料填入該選單
            seasons.forEach(season => {
                const option = document.createElement('option');
                option.value = season;
                option.textContent = seasonExpend(season);
                selectElement.appendChild(option);
            });
        });
    } catch (err) {
        console.error("層級選單初始化失敗:", err);
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
    名字遮罩功能
   ========================================================================== */

function maskName(nameStr) {
    if (!nameStr || nameStr === '-') return '-';

    const names = nameStr.split(/[，, ]+/);

    const maskedArray = names.map(name => {
        const n = name.trim(); // 去除多餘空白
        if (!n) return "";

        const len = n.length;
        if (len === 2) {
            return n[0] + 'O';
        } else if (len >= 3) {
            return n[0] + 'O'.repeat(len - 2) + n[len - 1];
        }
        return n;
    });

    return maskedArray.filter(n => n !== "").join(', ');
}

/* ==========================================================================
    球員/家長搜尋功能
   ========================================================================== */
async function handleSearchMembers() {
    const year = document.getElementById('yearMembers').value;
    const type = document.getElementById('searchMembers').value;
    const keyword = document.getElementById('keywordMembers').value;

    if (!keyword) return alert("請輸入關鍵字");

    setSubmitting('btnTeam', true);
    const apiUrl = `/api/search?type=${type}&year=${year}&keyword=${encodeURIComponent(keyword)}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        const players = data.players || [];
        const parents = data.parents || [];
        const relatives = data.relatives || [];

        const section = document.getElementById('resultSectionMembers');
        const relatedArea = document.getElementById('relatedArea');

        section.style.display = 'block';
        relatedArea.style.display = 'none';

        if (players.length === 0 && parents.length === 0) {
            alert("🔍 查無相關資料，請檢查關鍵字或年份是否正確");
            section.style.display = 'none';
            relatedArea.style.display = 'none';
            return;
        }

        if (type === 'player') {
            // --- 主表顯示球員 ---
            renderMainTable("🏃 球員名單",
                "<tr><th>年份</th><th>球員 ID</th><th>中文姓名</th><th>英文姓名</th><th>背號</th><th>年級</th><th>狀態</th></tr>",
                players.map(item => `<tr>
                            <td>${item.year}</td>
                            <td>${item.player_id}</td>
                            <td><strong>${maskName(item.ch_name)}</strong></td>
                            <td><strong>${item.nickname}</strong></td>
                            <td>${item.jersey_number}</td>
                            <td>${item.grade}</td>
                            <td>${item.status}</td>
                        </tr>`)
            );

            // --- 副表顯示家長 ---
            if (parents.length > 0) {
                const tableBodyRows = parents.map(p => {
                    const allNames = relatives
                        .filter(r => r.family_id === p.family_id)
                        .map(r => r.player_name);
                    const uniqueNames = [...new Set(allNames)];
                    const matchedChildren = uniqueNames.join(", ");

                    return `
                            <tr>
                                <td>${p.year}</td>
                                <td>${p.parent_id}</td>
                                <td><strong>${maskName(p.ch_name)}</strong></td>
                                <td><strong>${p.nickname ?? "無家長資料"}</strong></td>
                                <td>${maskName(matchedChildren) || '無'}</td>
                            </tr>`;
                });

                renderRelatedTable("👨‍👩‍👧 關聯家長聯絡資訊",
                    "<tr><th>年份</th><th>家長 ID</th><th>中文姓名</th><th>暱稱</th><th>小孩</th></tr>",
                    tableBodyRows
                );
            }
            else {
                renderEmptyRelated("👨‍👩‍👧 關聯家長聯絡資訊", "此球員目前無關聯家長資料");
            }
        } else {
            // --- 主表顯示家長 ---
            renderMainTable("👨‍👩‍👧 家長名單",
                "<tr><th>年份</th><th>家長ID</th><th>中文姓名</th><th>暱稱</th><th>狀態</th></tr>",
                parents.map(item => `<tr>
                                        <td>${item.year}</td>
                                        <td>${item.parent_id}</td>
                                        <td><strong>${maskName(item.ch_name)}</strong></td>
                                        <td><strong>${item.nickname ?? "無家長資料"}</strong></td>
                                        <td>${item.status}</td>
                                    </tr>`)
            );

            // --- 副表顯示球員 (小孩) ---
            if (players.length > 0) {
                const playerRows = players.map(pl => {
                    const matchedParentNicknames = relatives
                        .filter(r => r.family_id === pl.family_id)
                        .map(r => r.parent_nickname)
                        .filter(name => name); // 排除空值

                    const uniqueParents = [...new Set(matchedParentNicknames)].join(", ");

                    return `
                            <tr>
                                <td>${pl.year}</td>
                                <td>${pl.player_id}</td>
                                <td><strong>${maskName(pl.ch_name)}</strong></td>
                                <td>${pl.nickname}</td>
                                <td>${pl.jersey_number}</td>
                                <td>${pl.grade}</td>
                                <td>${pl.status}</td>
                                <td>${uniqueParents || '<span style="color:#ccc;">(無家長資料)</span>'}</td>
                            </tr>`;
                });

                renderRelatedTable("🏃 關聯小孩 (球員) 資訊",
                    "<tr><th>年份</th><th>球員 ID</th><th>中文姓名</th><th>英文姓名</th><th>背號</th><th>年級</th><th>狀態</th><th>家長</th></tr>",
                    playerRows
                );
            }
            else {
                renderEmptyRelated("🏃 關聯小孩 (球員) 資訊", "此家長目前無關聯小孩資料");
            }
        }
        section.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        console.error("詳細錯誤資訊:", err);
        alert("連線伺服器出錯：" + err.message);
    } finally {
        setSubmitting('btnTeam', false);
    }
}

function renderMainTable(title, headHtml, bodyRows) {
    document.getElementById('titleMembers').innerText = title;
    document.getElementById('headMembers').innerHTML = headHtml;
    document.getElementById('bodyMembers').innerHTML = bodyRows.join('');
}

function renderRelatedTable(title, headHtml, bodyRows) {
    document.getElementById('relatedArea').style.display = 'block';
    document.getElementById('relatedTitle').innerText = title;
    document.getElementById('headRelated').innerHTML = headHtml;
    document.getElementById('bodyRelated').innerHTML = bodyRows.join('');
}

async function renderRelativeTable(type, familyID) {
    if (!familyID) return;
    try {
        const response = await fetch(`/api/relative?family_id=${familyID}`);
        const relatives = await response.json();
        if (relatives.length === 0) return;

        const head = document.getElementById('headMembers');
        const body = document.getElementById('bodyMembers');

        head.innerHTML += "<tr><th colspan='5' style='background: #f0f0f0;'>👪 親屬資料</th></tr>";
        body.innerHTML += relatives.map(item => `
                    <tr>
                        <td>${item.year}</td>
                        <td><small>${item.relative_id}</small></td>
                        <td><strong>${item.name}</strong></td>
                        <td>${item.relationship}</td>
                        <td>${item.contact}</td>
                    </tr>`).join('');
    } catch (err) {
        console.error("載入親屬資料失敗", err);
    }

}

/* ==========================================================================
    球隊專用搜尋功能
   ========================================================================== */
document.getElementById('yearTeamOnly').addEventListener('click', updateTeamFromYearOptions);
document.getElementById('levelTeamOnly').addEventListener('click', updateTeamFromYearOptions);

async function updateTeamFromYearOptions() {

    const year = document.getElementById('yearTeamOnly').value;
    const level = document.getElementById('levelTeamOnly').value;
    const selectTeam = document.getElementById('selectTeamOnly');

    // 清空舊的選項
    selectTeam.innerHTML = '<option value="">-- 所有隊伍 --</option>';

    try {
        const response = await fetch(`/api/team-by-year-level?year=${encodeURIComponent(year)}&level=${encodeURIComponent(level)}`);
        const teams = await response.json();

        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.team_id;
            option.textContent = team.team_id;
            selectTeam.appendChild(option);
        });
    } catch (err) {
        console.error("無法取得賽別列表:", err);
    }
}

async function handleSearchTeamOnly() {
    const year = document.getElementById('yearTeamOnly').value;
    const level = document.getElementById('levelTeamOnly').value; // 取得選取的層級
    const keyword = document.getElementById('selectTeamOnly').value;

    document.getElementById('personSection').style.display = 'none';
    document.getElementById('inRoleSection').style.display = 'none';

    setSubmitting('btnTeam', true);
    try {
        // 組合 API URL，帶入 level 參數
        const apiUrl = `/api/search-team?keyword=${encodeURIComponent(keyword)}&year=${year}&level=${encodeURIComponent(level)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.length === 0) {
            alert("查無球隊資料");
            return;
        }

        const body = document.getElementById('teamBodyOnly');
        const section = document.getElementById('teamSectionOnly');

        body.innerHTML = data.map(item => `
            <tr>
                <td><small>${item.team_id}</small></td>
                <td>${item.year}</td>
                <td>${item.level}</td>
                <td>
                    <a href="javascript:void(0)" class="team-link" 
                        onclick="fetchPlayersByTeam('${item.team_id}', '${item.team_name}')">
                        ${item.team_name}
                    </a>
                </td>
                <td><small>${item.group_time}<br>@${item.group_place}</small></td>
                <td><small>${item.night_time || '-'}<br>@${item.night_place || '-'}</small></td>
                <td><small>${item.rain_time}<br>@${item.rain_place}</small></td>
            </tr>
        `).join('');

        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        alert("查詢失敗");
    } finally {
        setSubmitting('btnTeam', false);
    }
}

/* ==========================================================================
    依隊伍取得球員名單
   ========================================================================== */
async function fetchPlayersByTeam(teamId, teamName) {
    try {
        fetchInRoleByTeam(teamId, teamName);

        const response = await fetch(`/api/team-player?team_id=${teamId}`);
        if (!response.ok) throw new Error("Server Error");

        const players = await response.json();
        if (players.length === 0) {
            alert(`目前 ${teamName} 內尚無球員資料`);
            return;
        }

        document.getElementById('teamSectionOnly').style.display = 'none';

        renderPersonTable('player', players, teamName);
        const pSection = document.getElementById('personSection');
        pSection.style.display = 'block';

    } catch (err) {
        console.error(err);
        alert("讀取球員名單失敗");
    }
}

async function fetchInRoleByTeam(teamId, teamName) {
    try {
        const response = await fetch(`/api/team-inrole?team_id=${teamId}`);
        if (!response.ok) throw new Error("Server Error");

        const players = await response.json();
        if (players.length === 0) {
            alert(`目前 ${teamName} 內尚無球員資料`);
            return;
        }

        document.getElementById('teamSectionOnly').style.display = 'none';

        renderInRoleTable('player', players, teamName);
        const pSection = document.getElementById('inRoleSection');
        pSection.style.display = 'block';
        pSection.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        console.error(err);
        alert("讀取球員名單失敗");
    }
}

function renderPersonTable(type, data, contextName = "") {
    const head = document.getElementById('personHead');
    const body = document.getElementById('personBody');
    const title = document.getElementById('personTitle');

    if (type === 'player') {
        title.innerText = `🏃 ${contextName} - 球員名單`;
        head.innerHTML = "<tr><th>年份</th><th>球員 ID</th><th>球隊 ID</th><th>中文姓名</th><th>英文姓名</th><th>背號</th><th>年級</th><th>狀態</th></tr>";
        body.innerHTML = data.map(item => `
                    <tr>
                        <td>${item.year || '-'}</td>
                        <td><small>${item.player_id}</small></td>
                        <td>${item.p_team_id}</td>
                        <td><strong>${maskName(item.ch_name)}</strong></td>
                        <td>${item.nickname}</td>
                        <td>${item.jersey_number}</td>
                        <td>${item.grade}</td>
                        <td>${item.status}</td>
                    </tr>`).join('');
    }
}

function renderInRoleTable(type, data, contextName = "") {
    const head = document.getElementById('inRoleHead');
    const body = document.getElementById('inRoleBody');
    const title = document.getElementById('inRoleTitle');
    if (type === 'player') {
        title.innerText = `🏃 ${contextName} - 教練名單`;
        head.innerHTML = "<tr><th>年份</th><th>ID</th><th>球隊 ID</th><th>暱稱</th><th>職位</th></tr>";
        body.innerHTML = data.map(item => `
                    <tr>
                        <td>${item.year || '-'}</td>
                        <td><small>${item.r_parent_id}</small></td>
                        <td>${item.team_id}</td>
                        <td><strong>${item.nickname ?? "無家長資料"}</strong></td>
                        <td>${item.role}</td>
                    </tr>`).join('');
    }
}

function backToTeamList() {
    document.getElementById('personSection').style.display = 'none';
    document.getElementById('inRoleSection').style.display = 'none';
    const teamSection = document.getElementById('teamSectionOnly');
    teamSection.style.display = 'block';
    teamSection.scrollIntoView({ behavior: 'smooth' });
}

/* ==========================================================================
    賽程搜尋功能
    ========================================================================== */
document.getElementById('seasonGameSearch').addEventListener('click', updateTeamFromSeasonOptions);
document.getElementById('levelGameSearch').addEventListener('click', updateTeamFromSeasonOptions);

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
        section.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        alert("查詢失敗");
    } finally {
        setSubmitting('btnGameSearch', false);
    }
}

// 主審出勤排行榜
async function fetchUmpireRanking() {
    const season = document.getElementById('seasonGameSearch').value;
    const level = document.getElementById('levelGameSearch').value;
    const body = document.getElementById('umpireBody');
    const section = document.getElementById('umpireSection');
    const titleSpan = document.getElementById('umpireTitle');

    body.innerHTML = '<tr><td colspan="4">📊 正在統計 ' + (season || '歷年') + ' 主審數據...</td></tr>';
    section.style.display = 'block';
    titleSpan.innerText = `🏅 ${season || '歷年'} 主審出勤排行榜`;
    try {
        const response = await fetch(`/api/umpire-ranking?season=${encodeURIComponent(season)}&level=${encodeURIComponent(level)}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            body.innerHTML = '';
            result.data.forEach((item, index) => {
                const tr = document.createElement('tr');

                let nameStyle = "font-weight: bold;";

                tr.innerHTML = `
                    <td style="font-weight: bold;">${index + 1}</td>
                    <td style="${nameStyle}">${item.head_umpire}</td>
                    <td style="color: #27ae60; font-weight: bold;">${item.duty_count} 場</td>
                `;
                body.appendChild(tr);
            });
        } else {
            body.innerHTML = '<tr><td colspan="4" style="padding: 30px; color: #999;">查無該年度的主審執法紀錄</td></tr>';
        }
    } catch (err) {
        console.error("無法取得主審排名:", err);
        body.innerHTML = '<tr><td colspan="4" style="color: red;">⚠️ 伺服器連線失敗</td></tr>';
    }
}

/* ==========================================================================
    賽事排名排行榜
    ========================================================================== */
document.getElementById('seasonRank').addEventListener('click', updateRoundOptions);

async function updateRoundOptions() {

    const season = document.getElementById('seasonRank').value;
    const roundSelect = document.getElementById('roundRank');
    const levelSelect = document.getElementById('levelRank');
    // 清空舊的選項
    roundSelect.innerHTML = '<option value="">-- 選擇賽別 --</option>';
    levelSelect.innerHTML = '<option value="">-- 選擇層級 --</option>';

    try {
        const response = await fetch(`/api/round?season=${encodeURIComponent(season)}`);
        const rounds = await response.json();

        rounds.forEach(round => {
            const option = document.createElement('option');
            option.value = round.round;
            option.textContent = round.round;
            roundSelect.appendChild(option);
        });
    } catch (err) {
        console.error("無法取得賽別列表:", err);
    }
}

document.getElementById('roundRank').addEventListener('click', updateLevelOptions);
async function updateLevelOptions() {

    const season = document.getElementById('seasonRank').value;
    const round = document.getElementById('roundRank').value;
    const levelSelect = document.getElementById('levelRank');
    // 清空舊的選項
    levelSelect.innerHTML = '<option value="">-- 選擇層級 --</option>';
    try {
        const response = await fetch(`/api/level-by-round?season=${encodeURIComponent(season)}&round=${encodeURIComponent(round)}`);
        const levels = await response.json();
        levels.forEach(level => {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            levelSelect.appendChild(option);
        });
    } catch (err) {
        console.error("無法取得層級列表:", err);
    }
}

document.getElementById('levelRank').addEventListener('click', updateGroupOptions);
async function updateGroupOptions() {
    const season = document.getElementById('seasonRank').value;
    const round = document.getElementById('roundRank').value;
    const level = document.getElementById('levelRank').value;
    const groupSelect = document.getElementById('groupRank');
    // 清空舊的選項
    groupSelect.innerHTML = '<option value="">-- 選擇組別 --</option>';
    try {
        const response = await fetch(`/api/group-by-round-level?season=${encodeURIComponent(season)}&round=${encodeURIComponent(round)}&level=${encodeURIComponent(level)}`);
        const groups = await response.json();
        console.log(groups, groups.length);
        if (groups.length === 1 && groups[0] === null) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "無組別資料";
            groupSelect.appendChild(option);
            return;
        }

        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            groupSelect.appendChild(option);
        });

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


// 控制按鈕狀態
function setSubmitting(btnId, isSubmitting) {
    const btn = document.getElementById(btnId);
    btn.disabled = isSubmitting;
}

/* ==========================================================================
    清除搜尋內容與結果
    ========================================================================== */
// --- 清除綜合查詢內容與結果 ---
function clearMembersSearch() {
    document.getElementById('yearMembers').value = '2025'; // 回到預設年份
    document.getElementById('searchMembers').selectedIndex = 0; // 回到第一個選項
    document.getElementById('keywordMembers').value = "";

    document.getElementById('resultSectionMembers').style.display = 'none';
    document.getElementById('relatedArea').style.display = 'none';

    document.getElementById('bodyMembers').innerHTML = "";
    document.getElementById('bodyRelated').innerHTML = "";
}

// --- 清除球隊查詢內容與結果 ---
function clearTeamSearch() {
    document.getElementById('yearTeamOnly').value = "";
    document.getElementById('levelTeamOnly').selectedIndex = 0; // 重置層級選單
    document.getElementById('selectTeamOnly').value = "";

    document.getElementById('teamSectionOnly').style.display = 'none';
    document.getElementById('inRoleSection').style.display = 'none';
    document.getElementById('personSection').style.display = 'none';

    document.getElementById('teamBodyOnly').innerHTML = "";
    document.getElementById('personBody').innerHTML = "";
}

// --- 清除賽程查詢內容與結果 ---
function clearGameSearch() {
    document.getElementById('levelGameSearch').selectedIndex = 0; // 重置層級選單
    document.getElementById('seasonGameSearch').selectedIndex = 0;
    document.getElementById('selectGameSearch').value = "";

    document.getElementById('gameSectionOnly').style.display = 'none';
    document.getElementById('umpireSection').style.display = 'none';

    document.getElementById('gameBodyOnly').innerHTML = "";
    document.getElementById('umpireBody').innerHTML = "";
}

function clearRankSearch() {
    document.getElementById('seasonRank').selectedIndex = 0;
    document.getElementById('roundRank').innerHTML = '<option value="">-- 選擇賽別 --</option>';
    document.getElementById('levelRank').innerHTML = '<option value="">-- 選擇層級 --</option>';
    document.getElementById('groupRank').value = "";
    document.getElementById('rankSection').style.display = 'none';
    document.getElementById('rankBody').innerHTML = "";
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