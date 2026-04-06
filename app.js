const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const { isLoggedIn, checkRole } = require('./middlewares/authMiddleware');

// 設定 session
app.use(session({
    secret: 'baseball-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Session 有效期為1天
    // cookie: { maxAge: 1 * 60 * 1000 } // Session 有效期為1分鐘（測試用）
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// public
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/enroll', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'enroll.html'));
});
app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/member', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'member.html'));
});

// private
app.get('/fields', checkRole('member'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fields.html'));
});
app.get('/teams', checkRole('member'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teams.html'));
});
app.get('/umpire', checkRole('umpire'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'umpire.html'));
});
app.get('/admin', checkRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

const publicRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

app.use('/api', publicRoutes);
app.use('/auth', authRoutes);

// 啟動伺服器
const PORT = 4000;
const server = app.listen(PORT, () => {
    console.log(`專案已啟動：http://localhost:${PORT}`);
});

server.on('error', (err) => {
    console.error('伺服器啟動失敗：', err);
});