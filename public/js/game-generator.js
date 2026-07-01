async function handleGenerateSchedule() {
    const btn = document.getElementById('generate-btn');
    const msg = document.getElementById('status-msg');
    const previewSection = document.getElementById('preview-section');
    const tbody = document.getElementById('schedule-body');

    // 抓取網頁表單的值
    const config = {
        season: document.getElementById('season_type').value,
        level: document.getElementById('level_type').value,
        start_date: document.getElementById('start_date').value,
        num_teams: parseInt(document.getElementById('num_teams').value),
        games_per_day: parseInt(document.getElementById('games_per_day').value),
        random_seed: document.getElementById('random_seed').value ? parseInt(document.getElementById('random_seed').value) : 42
    };

    btn.disabled = true;
    msg.innerHTML = "⏳ 正在計算最優賽程組合，請稍候...";

    try {
        const response = await fetch('/api/generate-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) throw new Error('伺服器生成失敗');

        // 🏆 關鍵：接收 JSON 資料而不是 Blob 檔案
        const scheduleData = await response.json();
        console.log("從伺服器收到的原始資料:", scheduleData);

        // 渲染表格內容
        tbody.innerHTML = scheduleData.map(item => {
            // 判斷球衣顏色的輔助函式
            const getJerseyClass = (color) => {
                if (color === '紅色') return 'jersey-red';
                if (color === '黑色') return 'jersey-black';
                return '';
            };

            return `
        <tr>
            <td contenteditable="true" class="edit-cell">${item.日期}</td>
            <td style="background: #f0f0f0; font-weight: bold;">${item.場次}</td>
            <td contenteditable="true" class="edit-cell" style="font-weight: 500;">${item['客隊(先攻)']}</td>
            <td contenteditable="true" class="edit-cell ${getJerseyClass(item.客隊球衣)}">${item.客隊球衣}</td>
            <td contenteditable="true" class="edit-cell" style="font-weight: 500;">${item['主隊(後攻)']}</td>
            <td contenteditable="true" class="edit-cell ${getJerseyClass(item.主隊球衣)}">${item.主隊球衣}</td>
            <td contenteditable="true" class="edit-cell" style="font-size: 0.9em; color: #666;">${item.備註 || ''}</td>
        </tr>
    `;
        }).join('');

        // 顯示預覽區塊並捲動到位
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth' });

        msg.innerHTML = "<span style='color:green'>✅ 賽程已產出！您可以在下方表格直接修改文字，確認後點擊下載。</span>";
    } catch (err) {
        msg.innerHTML = "<span style='color:red'>❌ 生成失敗，請確認參數是否正確（隊伍數需為3-8）。</span>";
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

async function downloadEditedSchedule() {
    const rows = document.querySelectorAll('#schedule-body tr');
    const msg = document.getElementById('status-msg');
    const level = document.getElementById('level_type').value;

    // 抓取目前表格內的所有文字內容
    const editedData = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        return {
            "日期": cells[0].innerText,
            "場次": cells[1].innerText,
            "客隊(先攻)": cells[2].innerText,
            "客隊球衣": cells[3].innerText,
            "主隊(後攻)": cells[4].innerText,
            "主隊球衣": cells[5].innerText,
            "備註": cells[6].innerText
        };
    });

    msg.innerText = "💾 正在封裝您的修改並產出 Excel...";

    try {
        const response = await fetch('/api/download-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: editedData,
                filename: `${level}_自定義賽程表`
            })
        });

        if (!response.ok) throw new Error('Excel 產製失敗');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${level}_最終賽程表.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

        msg.innerHTML = "<span style='color:green'>✅ 最終賽程表已下載完成！</span>";
    } catch (err) {
        msg.innerHTML = "<span style='color:red'>❌ 下載失敗，請聯絡系統管理員。</span>";
    }
}