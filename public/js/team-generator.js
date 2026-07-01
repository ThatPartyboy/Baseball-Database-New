async function handleGenerateTeams() {
    const fileInput = document.getElementById("team_file");
    const yearInput = document.getElementById("team_year");
    const seedInput = document.getElementById("team_random_seed");
    const statusMsg = document.getElementById("team-status-msg");
    const button = document.getElementById("generate-team-btn");

    statusMsg.className = "";
    statusMsg.textContent = "";

    if (!fileInput.files || fileInput.files.length === 0) {
        statusMsg.className = "error";
        statusMsg.textContent = "請先上傳球員資料 Excel 檔案。";
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("team_year", yearInput.value || "2026");
    formData.append("random_seed", seedInput.value || "42");
    formData.append("include_diagnostics", "false");

    try {
        button.disabled = true;
        button.textContent = "生成中，請稍候...";
        statusMsg.className = "loading";
        statusMsg.textContent = "正在產生分隊表，請稍候。";

        const response = await fetch("/api/teams/generate", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "分隊表產生失敗");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        let filename = "Final_Team_Assignments.xlsx";
        const disposition = response.headers.get("Content-Disposition");

        if (disposition && disposition.includes("filename=")) {
            filename = disposition
                .split("filename=")[1]
                .replaceAll('"', "")
                .trim();
        }

        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);

        statusMsg.className = "success";
        statusMsg.textContent = "分隊表已成功產生並開始下載。";
    } catch (error) {
        statusMsg.className = "error";
        statusMsg.textContent = `發生錯誤：${error.message}`;
    } finally {
        button.disabled = false;
        button.textContent = "🚀 生成並下載分隊表";
    }
}