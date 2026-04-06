async function handleGenerateSchedule() {
    const btn = document.getElementById('generate-btn');
    const msg = document.getElementById('status-msg');
    
    // 抓取網頁表單的值
    const config = {
        season: document.getElementById('season_type').value, // 'spring' 或 'fall'
        level: document.getElementById('level_type').value,   // 'Minor', 'U8', 'Major'
        start_date: document.getElementById('start_date').value,
        num_teams: parseInt(document.getElementById('num_teams').value),
        games_per_day: parseInt(document.getElementById('games_per_day').value),
        random_seed: document.getElementById('random_seed').value ? parseInt(document.getElementById('random_seed').value) : undefined
    };

    btn.disabled = true;
    msg.innerText = "⏳ 正在排程並生成 Excel，請稍候...";

    try {
        const response = await fetch('/api/generate-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (!response.ok) throw new Error('伺服器處理失敗');

        // 處理二進制檔案下載
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = downloadUrl;
        a.download = `${config.level}_${config.season}_賽程表.xlsx`; // 設定下載檔名
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(downloadUrl);
        msg.innerHTML = "<span style='color:green'>✅ 賽程表已成功下載！</span>";
    } catch (err) {
        msg.innerHTML = "<span style='color:red'>❌ 生成失敗，請確認參數是否正確或連線正常。</span>";
    } finally {
        btn.disabled = false;
    }
}