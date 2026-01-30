// 檢查是否登入
function isLoggedIn(req, res, next) {
    if (req.session.user) return next();
    res.redirect('/login');
}

// 檢查角色等級 (支援階層權限)
function checkRole(requiredRole) {
    return (req, res, next) => {
        const user = req.session.user;

        req.session.returnTo = req.originalUrl;

        // 1. 如果沒登入，去登入頁
        if (!user) return res.redirect('/login');

        // 2. 管理層 (admin) 擁有最高權限，直接放行
        if (user.role === 'admin') return next();

        // 3. 檢查目前角色是否符合要求
        if (user.role === requiredRole) return next();

        // 4. 以上都不符合，回傳權限不足
        res.send(`
            <script>
                alert("您沒有權限訪問此頁面");
                window.location.href = "/";
            </script>
        `);
    };
}


module.exports = { checkRole };