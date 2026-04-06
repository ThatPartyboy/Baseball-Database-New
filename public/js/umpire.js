window.addEventListener('DOMContentLoaded', async () => {
    // 傳入所有需要顯示層級的選單 ID
    initializedSerNoDropdowns();
    loadDuplicateManager();
});

async function initializedSerNoDropdowns() {
    const currentDay = getCurrentDate();
    const currentDateElem = document.getElementById('currentDate');
    currentDateElem.textContent = `目前日期：${currentDay}`;

    const selectSerNo = document.getElementById('serNoGameSearch');
    selectSerNo.innerHTML = '<option value="">-- 選擇場序 --</option>';

    try {
        const response = await fetch(`/api/serNo-by-date?date=${encodeURIComponent(currentDay)}`);
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
    const currentDay = getCurrentDate();
    const currentDateElem = document.getElementById('currentDate');
    currentDateElem.textContent = `目前日期：${currentDay}`;

    const serNo = document.getElementById('serNoGameSearch').value;

    setSubmitting('btnGameSearch', true);
    try {
        const apiUrl = `/api/search-game?keyword=${encodeURIComponent(serNo)}&date=${encodeURIComponent(currentDay)}`;
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

async function handleSubmitResult() {
    const serNo = document.getElementById('serNoGameSearch').value;
    const guestScore = parseInt(document.getElementById('guestScore').value);
    const homeScore = parseInt(document.getElementById('homeScore').value);
    const imageFile = document.getElementById('resultImage').files[0];

    console.log(guestScore, homeScore)

    if (!serNo || guestScore === "" || homeScore === "") {
        alert("請填寫場序與完整比分！");
        return;
    }

    let guestPoint = 0;
    let homePoint = 0;
    if (guestScore > homeScore) {
        guestPoint = 2;
    } else if (guestScore < homeScore) {
        homePoint = 2;
    } else {
        guestPoint = 1;
        homePoint = 1;
    }


    // 建立 FormData 用於傳送檔案
    const formData = new FormData();
    formData.append('season', await getCurrentSeason()); 
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
            loadDuplicateManager();
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

function getCurrentDate() {
    // const today = new Date();
    const today = new Date('2025-11-21');
    return today.toISOString().split('T')[0];
}

async function getCurrentSeason() {
    try {
        const response = await fetch(`/api/season`);
        const seasons = await response.json();
        return seasons[0];
    } catch (err) {
        console.error("無法取得賽季資料:", err);
    }
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

async function loadDuplicateManager() {
    const body = document.getElementById('duplicateListBody');
    const res = await fetch('/api/duplicate-results');
    const list = await res.json();

    body.innerHTML = list.map(item => `
        <tr class="${item.isLatest ? 'latest-row' : 'old-row'}">
            <td>${item.gameId}</td>
            <td>${item.uploadTime}</td>
            <td>
                <button onclick="showMatchResult('/images/results/${item.fileName}')" class="btn-view">查看</button>
                ${item.isLatest
            ? `<button disabled class="btn-disabled" title="最新版本不可刪除">鎖定</button>`
            : `<button onclick="deleteImage('${item.fileName}')" class="btn-clear">刪除舊版</button>`
        }
            </td>
        </tr>
    `).join('');
}

async function deleteImage(fileName) {
    if (!confirm(`確定要刪除舊版圖片 ${fileName} 嗎？`)) return;

    try {
        const res = await fetch(`/api/delete-result-image/${fileName}`, {
            method: 'DELETE'
        });
        const result = await res.json();

        if (result.success) {
            alert('刪除成功！');
            // 💡 關鍵：刪除後再次呼叫，畫面上重複的項目就會消失
            loadDuplicateManager();
        } else {
            alert('刪除失敗：' + result.error);
        }
    } catch (err) {
        console.error("刪除發生錯誤:", err);
    }
}