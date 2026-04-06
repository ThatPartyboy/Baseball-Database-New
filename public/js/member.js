document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function () {
        // 1. 切換 active 樣式
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');

        const target = this.getAttribute('data-target');
        const display = document.getElementById('content-display');

        // 2. 根據目標載入對應內容
        switch (target) {
            // 在切換 Data Target 的 Switch 邏輯中
            case 'team-info':
                // 先在右側內容區準備好容器
                display.innerHTML = `
                    <div id="year-button"></div>
                    <div id="dynamic-content-area"></div>
                    <div id="game-search-area"></div>
                    <div id="ranking-search-area"></div>  
                `;

                // 呼叫初始化函式，填入年份與內容
                initTeamInfo();
                break;
            case 'umpire-zone':
                display.innerHTML = '<h3>裁判管理專區</h3><div id="game-search-area"></div>';
                // 這裡可以呼叫載入賽事查詢的 API
                break;
            case 'game-query':
                // 這裡放入你 image_203060.png 那種上傳介面的 HTML
                display.innerHTML = `<h3>查詢系統</h3><div id="upload-form">...</div>`;
                break;
        }
    });
});

async function initTeamInfo() {
    const yearButtonContainer = document.getElementById('year-button');
    if (!yearButtonContainer) return;

    try {
        // 1. 向你原本的 API 請求年份
        const response = await fetch('/api/available-years');
        const years = await response.json();

        if (years.length > 0) {
            // 2. 產生年份按鈕 HTML
            const yearButtons = years.map((y, index) => `
                <button class="year-btn ${index === 0 ? 'active' : ''}" data-year="${y.year}">
                    ${y.year}
                </button>
            `).join('');

            // 3. 注入到 sidebar 切換出來的空殼中
            yearButtonContainer.innerHTML = `<div class="year-menu">${yearButtons}</div>`;

            // 4. 預設載入最新年份的四組分類 (Junior/Major...)
            loadLevelData(years[0].year);
        }
    } catch (error) {
        console.error('初始化隊組資料失敗:', error);
        yearButtonContainer.innerHTML = '<p>載入年份失敗，請稍後再試</p>';
    }
}

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
