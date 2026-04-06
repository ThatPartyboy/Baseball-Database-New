import pandas as pd
import itertools
import random
import sys
import json
import os
from datetime import datetime, timedelta

# 確保輸出目錄存在
EXPORT_DIR = "exports"
if not os.path.exists(EXPORT_DIR):
    os.makedirs(EXPORT_DIR)


def get_venue_info(level_type):
    """統一管理球場資訊"""
    venue_map = {
        "Minor": ("週六", "月眉球場", "N"),
        "U8": ("週日", "中大b球場", "U"),
        "Major": ("週日", "月眉球場", "M")
    }
    return venue_map.get(level_type, ("週日", "未知球場", "T"))


def generate_spring(num_teams, level_type, start_date_str, games_per_day, randomseed):
    """上半季邏輯 (含排名賽)"""
    teams = [chr(65 + i) for i in range(num_teams)]

    # 對戰組合生成
    if num_teams == 3:
        all_pairings = list(itertools.combinations(teams, 2)) * 3
    elif num_teams == 4:
        all_pairings = list(itertools.combinations(teams, 2)) * 2
    elif num_teams in [5, 6, 7]:
        all_pairings = list(itertools.combinations(teams, 2))
    elif num_teams == 8:
        grp_a, grp_b = teams[:4], teams[4:]
        all_pairings = list(itertools.combinations(grp_a, 2)) + \
            list(itertools.combinations(grp_b, 2))

    current_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    day_name, venue, serNo = get_venue_info(level_type)

    final_schedule = []
    home_balance = {t: 0 for t in teams}
    away_balance = {t: 0 for t in teams}
    match_pool = all_pairings.copy()
    random.seed(randomseed)
    random.shuffle(match_pool)

    week_offset = 0
    total_matches = 0
    max_daily_per_team = 1 if num_teams <= 4 else 2

    # 例行賽排程
    while match_pool:
        played_counts = {t: home_balance[t] + away_balance[t] for t in teams}
        match_pool.sort(key=lambda m: (
            played_counts[m[0]] + played_counts[m[1]]))
        daily_matches = []
        team_daily_count = {t: 0 for t in teams}
        team_daily_role = {t: None for t in teams}
        team_today_jersey = {t: None for t in teams}
        game_date = current_date + timedelta(weeks=week_offset)
        temp_pool = []

        for match in match_pool:
            t1, t2 = match
            if len(daily_matches) < games_per_day and team_daily_count[t1] < max_daily_per_team and team_daily_count[t2] < max_daily_per_team:
                # 先後攻與球衣邏輯
                if team_daily_role[t1] and not team_daily_role[t2]:
                    away, home = (
                        t2, t1) if team_daily_role[t1] == "Away" else (t1, t2)
                elif team_daily_role[t2] and not team_daily_role[t1]:
                    away, home = (
                        t1, t2) if team_daily_role[t2] == "Away" else (t2, t1)
                elif team_daily_role[t1] and team_daily_role[t2]:
                    if team_daily_role[t1] != team_daily_role[t2]:
                        away, home = (
                            t1, t2) if team_daily_role[t1] == "Home" else (t2, t1)
                    else:
                        temp_pool.append(match)
                        continue
                else:
                    if home_balance[t1] > home_balance[t2]:
                        away, home = t1, t2
                    elif home_balance[t2] > home_balance[t1]:
                        away, home = t2, t1
                    else:
                        away, home = (
                            t1, t2) if random.random() > 0.5 else (t2, t1)

                team_daily_role[away], team_daily_role[home] = "Away", "Home"
                color1, color2 = team_today_jersey[away], team_today_jersey[home]
                if color1 and color2 and color1 == color2:
                    temp_pool.append(match)
                    continue

                if color1:
                    away_j = color1
                    home_j = "黑色" if away_j == "紅色" else "紅色"
                elif color2:
                    home_j = color2
                    away_j = "黑色" if home_j == "紅色" else "紅色"
                else:
                    away_j = "黑色" if len(daily_matches) % 2 == 0 else "紅色"
                    home_j = "紅色" if away_j == "黑色" else "黑色"

                team_today_jersey[away], team_today_jersey[home] = away_j, home_j
                home_balance[home] += 1
                away_balance[away] += 1
                team_daily_count[t1] += 1
                team_daily_count[t2] += 1
                total_matches += 1
                daily_matches.append({
                    "日期": game_date.strftime("%Y-%m-%d"), "星期": day_name, "場次": f"{serNo}-{total_matches}",
                    "地點": venue, "客隊(先攻)": away, "客隊球衣": away_j, "主隊(後攻)": home, "主隊球衣": home_j, 
                    "備註": "連打或隔場" if (team_daily_count[t1] == 2 or team_daily_count[t2] == 2) else ""
                })
            else:
                temp_pool.append(match)
        final_schedule.extend(daily_matches)
        match_pool = temp_pool
        week_offset += 1
        if week_offset > 52:
            break

    # 8隊特別排名賽
    if num_teams == 8:
        extra_stages = [[("A1", "B2"), ("A2", "B1"), ("A3", "B4"), ("A4", "B3")], [
            ("W1", "W2"), ("L1", "L2"), ("W3", "W4"), ("L3", "L4")]]
        for stage in extra_stages:
            game_date = current_date + timedelta(weeks=week_offset)
            for i, match in enumerate(stage):
                total_matches += 1
                final_schedule.append({
                    "日期": game_date.strftime("%Y-%m-%d"), "星期": day_name, "場次": f"{serNo}-{total_matches}",
                    "地點": venue, "客隊(先攻)": match[0], "客隊球衣": "黑色" if i % 2 == 0 else "紅色",
                    "主隊(後攻)": match[1], "主隊球衣": "紅色" if i % 2 == 0 else "黑色", "備註": "排名賽"
                })
            week_offset += 1

    return save_to_excel(final_schedule, f"{level_type}_春季賽程")


def generate_fall(num_teams, level_type, start_date_str, games_per_day, randomseed=42):
    """下半季邏輯 (含例行賽與季後賽)"""

    teams = [chr(65 + i) for i in range(num_teams)]

    # 2. 根據規則生成例行賽對戰組合
    all_pairings = []
    if num_teams == 3:
        all_pairings = list(itertools.combinations(teams, 2)) * 3  # 3輪 9場
    elif num_teams == 4:
        all_pairings = list(itertools.combinations(teams, 2)) * 2  # 2輪 12場
    else:
        # 5, 6, 7, 8 隊皆為 1 輪例行賽
        all_pairings = list(itertools.combinations(teams, 2))

    # 3. 排程設定
    current_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    venue_info = {
        "Minor": ("週六", "月眉球場", "N"),
        "U8": ("週日", "中大b球場", "U"),
        "Major": ("週日", "月眉球場", "M")
    }
    day_name, venue, serNo = venue_info.get(level_type, ("週日", "未知球場", "T"))

    final_schedule = []
    home_balance = {t: 0 for t in teams}
    away_balance = {t: 0 for t in teams}

    match_pool = all_pairings.copy()
    random.seed(randomseed)
    random.shuffle(match_pool)
    week_offset = 0
    total_matches = 0

    # 自動判斷今天該不該排「連打」
    if num_teams <= 4:
        max_daily_per_team = 1  # 4隊以下，每隊一場就剛好排滿
    else:
        max_daily_per_team = 2  # 5隊以上，為了縮短賽季，允許有隊伍打兩場 (但你也可以強迫為1)

    # 4. 執行例行賽排程
    while match_pool:
        played_counts = {t: home_balance[t] + away_balance[t] for t in teams}
        match_pool.sort(key=lambda m: (
            played_counts[m[0]] + played_counts[m[1]]))

        daily_matches = []
        team_daily_count = {t: 0 for t in teams}
        team_daily_role = {t: None for t in teams}
        team_today_jersey = {t: None for t in teams}
        game_date = current_date + timedelta(weeks=week_offset)

        temp_pool = []
        for match in match_pool:
            t1, t2 = match
            if len(daily_matches) < games_per_day and team_daily_count[t1] < max_daily_per_team and team_daily_count[t2] < max_daily_per_team:
                # 先後攻與球衣邏輯 (沿用您的版本)
                if team_daily_role[t1] is not None and team_daily_role[t2] is None:
                    away, home = (
                        t2, t1) if team_daily_role[t1] == "Away" else (t1, t2)
                elif team_daily_role[t2] is not None and team_daily_role[t1] is None:
                    away, home = (
                        t1, t2) if team_daily_role[t2] == "Away" else (t2, t1)
                elif team_daily_role[t1] is not None and team_daily_role[t2] is not None:
                    if team_daily_role[t1] != team_daily_role[t2]:
                        away, home = (
                            t1, t2) if team_daily_role[t1] == "Home" else (t2, t1)
                    else:
                        temp_pool.append(match)
                        continue
                else:
                    if home_balance[t1] > home_balance[t2]:
                        away, home = t1, t2
                    elif home_balance[t2] > home_balance[t1]:
                        away, home = t2, t1
                    else:
                        away, home = (
                            t1, t2) if random.random() > 0.5 else (t2, t1)

                if team_daily_role[away] is None:
                    team_daily_role[away] = "Away"
                if team_daily_role[home] is None:
                    team_daily_role[home] = "Home"

                color1, color2 = team_today_jersey[away], team_today_jersey[home]
                if color1 and color2 and color1 == color2:
                    temp_pool.append(match)
                    continue

                if color1:
                    away_j = color1
                    home_j = "黑色" if away_j == "紅色" else "紅色"
                elif color2:
                    home_j = color2
                    away_j = "黑色" if home_j == "紅色" else "紅色"
                else:
                    slot = len(daily_matches)
                    away_j = "黑色" if slot % 2 == 0 else "紅色"
                    home_j = "紅色" if away_j == "黑色" else "黑色"

                team_today_jersey[away], team_today_jersey[home] = away_j, home_j
                home_balance[home] += 1
                away_balance[away] += 1
                team_daily_count[t1] += 1
                team_daily_count[t2] += 1
                total_matches += 1

                daily_matches.append({
                    "日期": game_date.strftime("%Y-%m-%d"), "星期": day_name, "場次": f"{serNo}-{total_matches}",
                    "地點": venue, "客隊(先攻)": away, "客隊球衣": away_j, "主隊(後攻)": home, "主隊球衣": home_j,
                    "備註": "例行賽"
                })
            else:
                temp_pool.append(match)

        final_schedule.extend(daily_matches)
        match_pool = temp_pool
        week_offset += 1
        if week_offset > 52:
            break

    # 5. 季後賽邏輯
    playoff_weeks = []
    if num_teams == 4:
        playoff_weeks = [
            [("Rank4", "Rank1"), ("Rank3", "Rank2")],  # 第一週
            [("W1_L", "W2_L"), ("W1_W", "W2_W")]    # 第二週: 季殿軍, 冠亞軍
        ]
    elif num_teams == 5:
        playoff_weeks = [
            [("Rank1", "Rank3"), ("Rank5", "Rank4")],  # 週1
            [("Rank3", "Rank2")],                    # 週2
            [("Rank2", "Rank1")]                     # 週3
        ]
    elif num_teams == 6:
        playoff_weeks = [
            [("Rank1", "Rank3"), ("Rank4", "Rank6")],  # 週1
            [("Rank3", "Rank2"), ("Rank6", "Rank5")],  # 週2
            [("Rank2", "Rank1"), ("Rank5", "Rank4")]  # 週3
        ]
    elif num_teams == 7:
        playoff_weeks = [
            [("Rank1", "Rank3"), ("Rank7", "Rank4"), ("Rank6", "Rank5")],  # 週1
            [("Rank3", "Rank2"), ("PW1_W", "PW2_W"),
             ("PW1_L", "PW2_L")],  # 週2 (PW為PrevWeek)
            [("Rank2", "Rank1")]                                          # 週3
        ]
    elif num_teams == 8:
        playoff_weeks = [
            [("A4", "A1"), ("A3", "A2"), ("B6", "B5"),
             ("B7", "B8")],  # 週1: A組/B組 樹狀首輪
            [("AW1_W", "AW2_W"), ("AW1_L", "AW2_L"),
             ("BW1_W", "BW2_W"), ("BW1_L", "BW2_L")]  # 週2: A/B組冠亞季殿
        ]

    # 排入季後賽場次
    for week_matches in playoff_weeks:
        daily_matches = []
        game_date = current_date + timedelta(weeks=week_offset)
        for i, match in enumerate(week_matches):
            away, home = match
            slot = len(daily_matches)
            total_matches += 1
            daily_matches.append({
                "日期": game_date.strftime("%Y-%m-%d"), "星期": day_name, "場次": f"{serNo}-{total_matches}",
                "地點": venue, "客隊(先攻)": away, "客隊球衣": "黑色" if slot % 2 == 0 else "紅色",
                "主隊(後攻)": home, "主隊球衣": "紅色" if slot % 2 == 0 else "黑色",
                "備註": "季後賽/決賽"
            })
        final_schedule.extend(daily_matches)
        week_offset += 1

    return save_to_excel(final_schedule, f"{level_type}_秋季賽程")


def save_to_excel(data, base_name):
    # 將內部存檔名改為純英文，例如 schedule_Minor_0406_2159.xlsx
    timestamp = datetime.now().strftime("%m%d_%H%M")

    # 這裡將 base_name 的中文部分拿掉或改用英文代號
    # 假設傳入的 base_name 是 "Minor_上半季賽程" -> 我們只取第一段 "Minor"
    level_code = base_name.split('_')[0]
    filename = f"schedule_{level_code}_{timestamp}.xlsx"

    filepath = os.path.join(EXPORT_DIR, filename)
    pd.DataFrame(data).to_excel(filepath, index=False)

    # 確保輸出的路徑是正確的
    return filepath


if __name__ == "__main__":
    try:
        # 從命令列讀取 JSON 參數
        input_data = json.loads(sys.argv[1])

        season = input_data.get("season", "spring")
        num_teams = int(input_data.get("num_teams", 6))
        level = input_data.get("level", "Minor")
        start_date = input_data.get("start_date", "2026-03-07")
        games_per_day = int(input_data.get("games_per_day", 4))
        randomseed = int(input_data.get("random_seed", 42))

        if season == "spring":
            result_path = generate_spring(
                num_teams, level, start_date, games_per_day, randomseed)
        else:
            result_path = generate_fall(
                num_teams, level, start_date, games_per_day, randomseed)

        # 成功後印出路徑，Node.js 會接收這行字串
        print(result_path)

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
