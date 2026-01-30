const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.getElementById('nav-menu');

menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    
    // 當垂直滾動超過 50 像素時
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. 向後端詢問登入狀態
        const response = await fetch('/auth/status');
        const data = await response.json();

        // 2. 尋找「成員登入」的連結
        // 建議在 HTML 的 <a> 標籤加上 id="login-link" 會更精準
        const loginLink = document.querySelector('a[href="/login"]');

        if (data.loggedIn && loginLink) {
            // 3. 如果登入成功，修改文字與連結
            loginLink.textContent = '登出';
            loginLink.href = '/auth/logout'; // 指向你的登出路由
            
            // (選配) 如果想顯示使用者帳號，可以加在旁邊
            // loginLink.insertAdjacentHTML('beforebegin', `<span>你好, ${data.user.username} </span>`);
        }
    } catch (err) {
        console.error('無法取得登入狀態:', err);
    }
});

