window.addEventListener('DOMContentLoaded', async () => {
    initializeSeasonDropdowns(['seasonGameSearch']);
    initializeGameLevelDropdowns(['levelGameSearch']);
});

async function initializeSeasonDropdowns(selectIds) {
    try {
        const response = await fetch('/api/season');
        const seasons = await response.json();

        selectIds.forEach(id => {
            const selectElement = document.getElementById(id);
            if (!selectElement) return;

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

/* ==========================================================================
    賽程搜尋功能
    ========================================================================== */
document.getElementById('seasonGameSearch').addEventListener('click', updateSerNoFromSeasonOptions);
document.getElementById('levelGameSearch').addEventListener('click', updateSerNoFromSeasonOptions);

async function clearGameOptions() {
    const level = document.getElementById('levelGameSearch');
    const selectSerNo = document.getElementById('serNoGameSearch');
}

async function updateSerNoFromSeasonOptions() {

    const season = document.getElementById('seasonGameSearch').value;
    const level = document.getElementById('levelGameSearch').value;
    const selectSerNo = document.getElementById('serNoGameSearch');
    selectSerNo.innerHTML = '<option value="">-- 選擇場序 --</option>';

    try {
        const response = await fetch(`/api/serNo-by-season-level?season=${encodeURIComponent(season)}&level=${encodeURIComponent(level)}`);
        const serNos = await response.json();
        serNos.forEach(serNo => {
            const option = document.createElement('option');
            option.value = serNo;
            option.textContent = serNo;
            selectSerNo.appendChild(option);
        });
    } catch (err) {
        console.error("無法取得賽別列表:", err);
    }
}

// 賽程搜尋
async function handleSearchGame() {
    const season = document.getElementById('seasonGameSearch').value;
    const level = document.getElementById('levelGameSearch').value;
    const serNo = document.getElementById('serNoGameSearch').value;

    setSubmitting('btnGameSearch', true);
    try {
        const apiUrl = `/api/search-game?keyword=${encodeURIComponent(serNo)}&season=${encodeURIComponent(season)}&level=${encodeURIComponent(level)}`;
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

async function handleSubmitResult() {
    const season = document.getElementById('seasonGameSearch').value;
    const level = document.getElementById('levelGameSearch').value;
    const serNo = document.getElementById('serNoGameSearch').value;
    const guestScore = document.getElementById('guestScore').value;
    const homeScore = document.getElementById('homeScore').value;
    const imageFile = document.getElementById('resultImage').files[0];

    if (!serNo || guestScore === "" || homeScore === "") {
        alert("請填寫場序與完整比分！");
        return;
    }

    let guestPoint = 0;
    let homePoint = 0;
    if(guestScore > homeScore){
        guestPoint = 2;
    } else if(guestScore < homeScore){
        homePoint = 2;
    } else {
        guestPoint = 1;
        homePoint = 1;
    }

    // 建立 FormData 用於傳送檔案
    const formData = new FormData();
    formData.append('season', season);
    formData.append('level', level);
    formData.append('serNo', serNo);
    formData.append('away_score', guestScore);
    formData.append('home_score', homeScore);
    formData.append('guest_point', guestPoint);
    formData.append('home_point', homePoint);
    if (imageFile) {
        formData.append('result_image', imageFile);
    }

    setSubmitting('btnSubmitResult', true);

    try {
        const response = await fetch('/api/upload-match-result', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (response.ok) {
            alert("上傳成功！");
            // 可選：重新整理下方賽程表
            handleSearchGame();
        } else {
            alert("上傳失敗：" + result.error);
        }
    } catch (err) {
        console.error("上傳過程發生錯誤:", err);
        alert("系統錯誤，請稍後再試");
    } finally {
        setSubmitting('btnSubmitResult', false);
    }
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