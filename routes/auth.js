const express = require('express');
const router = express.Router();
const db = require('../config/db'); // 引入資料庫連線池
// const bcrypt = require('bcrypt'); // 之後建議加入密碼加密驗證

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 從資料庫找出該使用者
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = users[0];

        // 檢查使用者是否存在且密碼正確 (測試階段先用明文，正式環境要用 bcrypt)
        if (user && user.password === password) {
            // 登入成功，將資料存入 Session
            req.session.user = {
                id: user.id,
                username: user.username,
                role: user.role // 這裡是 'member' 或 'admin'
            };

            const redirectUrl = req.session.returnTo || '/';
            delete req.session.returnTo;

            return res.json({ success: true, message: '登入成功', role: user.role, redirectUrl: redirectUrl });
        } else {
            return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: '伺服器錯誤' });
    }
});

router.get('/status', (req, res) => {
    if (req.session.user) {
        // 如果有 Session，回傳登入中與角色資訊
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        // 否則回傳未登入
        res.json({ loggedIn: false });
    }
});

// 登出邏輯也可以放在這
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/'); // 登出後導回首頁
    });
});
module.exports = router;