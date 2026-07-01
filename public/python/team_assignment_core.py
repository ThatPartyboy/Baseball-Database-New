import math
import os
import random
from datetime import date
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd

# ========================================================
# 基本設定（Node.js / 本機網頁版，不含 Colab）
# ========================================================
BASE_DIR = os.getcwd()
INPUT_FILENAME = 'active_players_data_300_sample.xlsx'
INPUT_SHEET_NAME = None  # None = 讀第一個 sheet；也可指定 'active_players_data'

TEAM_YEAR = 2026
OUTPUT_FILENAME = f'Final_Team_Assignments_{TEAM_YEAR}.xlsx'

# 最終分隊結果只輸出以下欄位，且依此順序排列
FINAL_OUTPUT_COLUMNS = [
    'family_id',
    'serial_number',
    'year',
    'player_id',
    'p_team_id',
    'ch_name',
    'nickname',
    'grade',
    'school_name',
    'jersey_number',
    'sibling',
    'level',
    'time_slot',
    'registrator',
]

# 預設只輸出分隊結果 sheets。若要除錯，可改成 True 輸出 Validation/Summary/Warnings/Normalized_Input。
INCLUDE_DIAGNOSTIC_SHEETS = False

RANDOM_SEED = 42  # 若想每次隨機，可改成 None

# 是否讓程式自動修正 U8/Junior/特別組的時段與場地
AUTO_NORMALIZE_TIME_AND_FIELD = True

# 每隊原則 11-15 人；隊數用 15 人上限估算
MIN_PLAYERS_PER_TEAM = 11
MAX_PLAYERS_PER_TEAM = 15

# 中大特別組補人規則：不足時補到每隊至少 11 人
SPECIAL_MIN_PER_TEAM = 11
SPECIAL_MAX_PER_TEAM = 15

TIME_PRIORITY = {
    '週六上午': 1,
    '週六下午': 2,
    '週日上午': 3,
    '週日下午': 4,
    '日期未定': 99,
}

# 一般組排序順序
GENERAL_POOL_ORDER = {
    ('Minor', '月眉', '週六上午'): 10,
    ('Minor', '月眉', '週六下午'): 20,
    ('Major', '月眉', '週日上午'): 30,
    ('Major', '月眉', '週日下午'): 40,
}

NEW_REGISTRATOR_VALUES = {'newapplied'}
RENEWED_REGISTRATOR_VALUES = {'renewed'}
TRUE_VALUES = {'true', 't', 'yes', 'y', '1', '是', '有', '教職員', 'staff', '中大', 'special', '抽中大'}
FALSE_VALUES = {'false', 'f', 'no', 'n', '0', '否', '無', 'none', '', 'nan'}

GRADE_RANK_MAP = {
    '九年級': 9,
    '八年級': 8,
    '七年級': 7,
    '六年級': 6,
    '五年級': 5,
    '四年級': 4,
    '三年級': 3,
    '二年級': 2,
    '一年級': 1,
    '大班': 0,
    '中班': -1,
    '小班': -2,
}

U8_SEQUENCE = [
    ('二年級', False),
    ('二年級', True),
    ('一年級', False),
    ('一年級', True),
    ('大班', False),
    ('大班', True),
    ('中班', False),
    ('中班', True),
    ('小班', False),
    ('小班', True),
]

warnings_log: List[Dict[str, object]] = []


def add_warning(category: str, message: str, player_id: Optional[str] = None, detail: Optional[object] = None) -> None:
    warnings_log.append({
        'category': category,
        'message': message,
        'player_id': player_id,
        'detail': '' if detail is None else str(detail),
    })


# ========================================================
# 通用工具
# ========================================================
def norm_text(value) -> str:
    if pd.isna(value):
        return ''
    return str(value).strip()


def norm_lower(value) -> str:
    return norm_text(value).lower()


def parse_bool(value) -> bool:
    v = norm_lower(value)
    if v in TRUE_VALUES:
        return True
    if v in FALSE_VALUES:
        return False
    return False


def get_grade_rank(grade_str) -> int:
    return GRADE_RANK_MAP.get(norm_text(grade_str), -99)


def get_level_category(grade_str) -> str:
    g = norm_text(grade_str)
    if g in ['九年級', '八年級', '七年級']:
        return 'Junior'
    if g in ['六年級', '五年級']:
        return 'Major'
    if g in ['四年級', '三年級']:
        return 'Minor'
    if g in ['二年級', '一年級', '大班', '中班', '小班']:
        return 'U8'
    return 'Unknown'


def is_new_player(registrator) -> bool:
    v = norm_lower(registrator)
    if v in NEW_REGISTRATOR_VALUES:
        return True
    if v in RENEWED_REGISTRATOR_VALUES:
        return False
    add_warning('未知 registrator', f'未知 registrator={registrator}，暫以舊生處理')
    return False


def normalize_level_value(row: pd.Series) -> str:
    raw_level = norm_text(row.get('level', ''))
    if raw_level in {'Junior', 'Major', 'Minor', 'U8'}:
        return raw_level
    calculated = get_level_category(row.get('grade', ''))
    if raw_level and raw_level != calculated:
        add_warning(
            'level 修正',
            f'level={raw_level} 無法使用，依 grade={row.get("grade", "")} 改為 {calculated}',
            player_id=norm_text(row.get('player_id', '')),
        )
    return calculated


def normalize_field_value(value) -> str:
    v = norm_text(value)
    aliases = {
        '中大': '中大',
        '中央': '中大',
        '中央大學': '中大',
        'ncu': '中大',
        'NCU': '中大',
        '月眉': '月眉',
        '月眉球場': '月眉',
        '大潭': '大潭',
        '大潭球場': '大潭',
    }
    return aliases.get(v, v)


def calculate_team_count(n_players: int, max_per_team: int = MAX_PLAYERS_PER_TEAM) -> int:
    """依 11-15 人一隊原則估算隊數；28=>2、35=>3。"""
    if n_players <= 0:
        return 0
    return max(1, math.ceil(n_players / max_per_team))


def special_team_count_and_target(n_players: int) -> Tuple[int, int, str]:
    """
    Major/Minor 中大特別組規則。
    回傳：(隊數, 目標補到幾人, 說明)
    """
    if n_players <= 0:
        return 0, 0, '無特別組'
    if 11 <= n_players <= 15:
        return 1, n_players, '11-15 人，成立一隊'
    if n_players <= 10:
        return 1, SPECIAL_MIN_PER_TEAM, '10 人以下，需補到至少 11 人'
    if 15 < n_players < 22:
        return 2, 2 * SPECIAL_MIN_PER_TEAM, '16-21 人，需補到至少 22 人後分兩隊'
    if 22 <= n_players < 30:
        return 2, n_players, '22-29 人，直接分兩隊'
    teams = calculate_team_count(n_players, SPECIAL_MAX_PER_TEAM)
    return teams, n_players, '30 人以上，依 15 人上限估算隊數'


def safe_sheet_name(name: str, used: set) -> str:
    base = ''.join(ch if ch not in r'[]:*?/\\' else '_' for ch in str(name))[:31]
    if not base:
        base = 'Sheet'
    candidate = base
    i = 1
    while candidate in used:
        suffix = f'_{i}'
        candidate = base[:31 - len(suffix)] + suffix
        i += 1
    used.add(candidate)
    return candidate


def team_letter(idx: int) -> str:
    """0=>A, 25=>Z, 26=>AA。"""
    idx += 1
    letters = ''
    while idx:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def make_team_id(prefix: str, start_code: int, team_index: int) -> str:
    return f'{TEAM_YEAR}{prefix}{team_letter(start_code + team_index)}'


# ========================================================
# 讀檔與標準化
# ========================================================
def load_input() -> pd.DataFrame:
    input_path = os.path.join(BASE_DIR, INPUT_FILENAME)

    if not os.path.exists(input_path):
        raise FileNotFoundError(
            f'找不到 input 檔案：{input_path}\n'
            f'請確認 BASE_DIR / INPUT_FILENAME 是否正確。'
        )

    if INPUT_SHEET_NAME:
        return pd.read_excel(input_path, sheet_name=INPUT_SHEET_NAME)

    return pd.read_excel(input_path)


def ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    required = ['family_id', 'player_id', 'ch_name', 'grade', 'registrator']
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f'input 缺少必要欄位：{missing}')

    optional_defaults = {
        'serial_number': '',
        'year': '',
        'p_team_id': '',
        'nickname': '',
        'school_name': '',
        'jersey_number': '',
        'sibling': '',
        'level': '',
        'time_slot': '',
        'field': '',
        'coach_group_id': '',
        'twin_group_id': '',
        'is_staff_child': False,
        'apply_ncu_draw': False,
        'special_group': False,
    }
    for col, default in optional_defaults.items():
        if col not in df.columns:
            df[col] = default
            if col in ['field', 'time_slot']:
                add_warning('缺少欄位', f'input 缺少 {col} 欄位，程式會依規則推估')

    return df


def filter_inactive_rows(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """若 input 含有 CoreData 狀態相關欄位，過濾校友 / 北區 / 退隊 / TB。"""
    df = df.copy()
    exclude_keywords = ['校友', '北區', '退隊', 'TB', 'TEE', 'TEEBALL']
    candidate_cols = [
        c for c in df.columns
        if c.lower() in {'status', 'team_status', 'division', 'program', 'group', 'category'}
        or c in {'狀態', '組別'}
    ]

    exclude_mask = pd.Series(False, index=df.index)
    for col in candidate_cols:
        values = df[col].astype(str).str.upper()
        for kw in exclude_keywords:
            exclude_mask |= values.str.contains(kw.upper(), na=False)

    # 若 level 明確是 TB，也排除
    if 'level' in df.columns:
        exclude_mask |= df['level'].astype(str).str.upper().str.contains('TB', na=False)

    excluded = df[exclude_mask].copy()
    active = df[~exclude_mask].copy()
    if not excluded.empty:
        add_warning('資料過濾', f'已過濾校友/北區/退隊/TB：{len(excluded)} 筆')
    return active, excluded


def standardize_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for col in ['family_id', 'player_id', 'ch_name', 'grade', 'registrator', 'time_slot', 'field']:
        df[col] = df[col].apply(norm_text)

    df['original_time_slot'] = df['time_slot']
    df['original_field'] = df['field']
    df['field'] = df['field'].apply(normalize_field_value)
    df['level'] = df.apply(normalize_level_value, axis=1)
    df['grade_rank'] = df['grade'].apply(get_grade_rank)
    df['is_new'] = df['registrator'].apply(is_new_player)
    df['is_staff_child'] = df['is_staff_child'].apply(parse_bool)
    df['apply_ncu_draw'] = df['apply_ncu_draw'].apply(parse_bool)
    df['special_group'] = df['special_group'].apply(parse_bool)
    df['ncu_draw_selected'] = False
    df['review_note'] = ''

    # family key：缺 family_id 時，以 player_id 當作自己家庭
    df['family_id_key'] = df['family_id'].replace({'': np.nan, 'nan': np.nan, 'None': np.nan})
    df['family_id_key'] = df['family_id_key'].fillna(df['player_id']).astype(str)

    # coach / twin keys
    df['coach_group_id'] = df['coach_group_id'].apply(norm_text)
    df['twin_group_id'] = df['twin_group_id'].apply(norm_text)

    # 若沒有 twin_group_id，暫以同家庭同年級視為可能雙胞胎群組
    df['twin_group_key'] = ''
    explicit_twin = df['twin_group_id'] != ''
    df.loc[explicit_twin, 'twin_group_key'] = 'TWIN_' + df.loc[explicit_twin, 'twin_group_id'].astype(str)

    family_grade_counts = df.groupby(['family_id_key', 'grade'])['player_id'].transform('count')
    inferred_twin = (~explicit_twin) & (family_grade_counts > 1)
    df.loc[inferred_twin, 'twin_group_key'] = (
        'INF_TWIN_' + df.loc[inferred_twin, 'family_id_key'].astype(str) + '_' + df.loc[inferred_twin, 'grade'].astype(str)
    )
    if inferred_twin.any():
        add_warning('雙胞胎推估', f'有 {int(inferred_twin.sum())} 筆未填 twin_group_id，但同家庭同年級，已暫時綁同隊')

    unknown_level = df[df['level'] == 'Unknown']
    for _, row in unknown_level.iterrows():
        add_warning('未知層級', 'grade 無法對應到 Junior/Major/Minor/U8，該球員可能不會被分隊', row['player_id'])

    return df


# ========================================================
# 特別組 / 時段 / 場地規則
# ========================================================
def compute_family_levels(df: pd.DataFrame) -> Dict[str, set]:
    return df.groupby('family_id_key')['level'].apply(lambda s: set(s.dropna())).to_dict()


def mark_special_groups(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    family_levels = compute_family_levels(df)

    is_special = []
    reasons = []
    for _, row in df.iterrows():
        level = row['level']
        fam_levels = family_levels.get(row['family_id_key'], set())
        reason_parts = []
        special = False

        if level in {'Major', 'Minor'}:
            # 手動指定 / 教職員子女 / 已填中大場地
            if row.get('special_group', False):
                special = True
                reason_parts.append('手動指定特別組')
            if row.get('is_staff_child', False):
                special = True
                reason_parts.append('中大教職員子女')
            if normalize_field_value(row.get('field', '')) == '中大':
                special = True
                reason_parts.append('field=中大')

            # 跨層級家庭規則：若家庭含 Junior，Junior+弟妹不觸發特別組
            if 'Junior' not in fam_levels:
                if level == 'Major' and (('Minor' in fam_levels) or ('U8' in fam_levels)):
                    special = True
                    reason_parts.append('Major 與 Minor/U8 手足')
                if level == 'Minor' and (('Major' in fam_levels) or ('U8' in fam_levels)):
                    special = True
                    reason_parts.append('Minor 與 Major/U8 手足')

        is_special.append(special)
        reasons.append('；'.join(reason_parts))

    df['is_ncu_special'] = is_special
    df['special_reason'] = reasons
    return df


def normalize_time_and_field(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for idx, row in df.iterrows():
        level = row['level']
        grade = row['grade']
        field = normalize_field_value(row['field'])
        time_slot = norm_text(row['time_slot'])
        original = (time_slot, field)

        if not AUTO_NORMALIZE_TIME_AND_FIELD:
            continue

        # U8：固定週日上午－中大
        if level == 'U8':
            time_slot = '週日上午'
            field = '中大'

        # Junior：固定週日上午－大潭，J13/J15 由 grade 切
        elif level == 'Junior':
            time_slot = '週日上午'
            field = '大潭'

        # Minor 中大特別組 / 月眉一般組
        elif level == 'Minor':
            if row.get('is_ncu_special', False):
                time_slot = '週日上午'
                field = '中大'
            else:
                field = '月眉'
                if time_slot not in {'週六上午', '週六下午'}:
                    time_slot = '週六上午'

        # Major 中大特別組 / 月眉一般組
        elif level == 'Major':
            if row.get('is_ncu_special', False):
                time_slot = '週日上午'
                field = '中大'
            else:
                field = '月眉'
                if time_slot not in {'週日上午', '週日下午'}:
                    time_slot = '週日上午'

        if original != (time_slot, field):
            add_warning(
                '時段/場地修正',
                f'由 time_slot={original[0] or "空"}, field={original[1] or "空"} 修正為 time_slot={time_slot}, field={field}',
                player_id=row['player_id'],
            )

        df.at[idx, 'time_slot'] = time_slot
        df.at[idx, 'field'] = field

    return df


def assign_pool_name(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    pool_names = []
    for _, row in df.iterrows():
        level = row['level']
        grade = row['grade']
        if level == 'U8':
            pool = 'U8_中大'
        elif grade == '七年級':
            pool = 'J13_大潭'
        elif grade in {'八年級', '九年級'}:
            pool = 'J15_大潭'
        elif level == 'Minor' and row.get('is_ncu_special', False):
            pool = 'Minor中大特別'
        elif level == 'Major' and row.get('is_ncu_special', False):
            pool = 'Major中大特別'
        elif level == 'Minor':
            pool = f'Minor月眉_{row["time_slot"]}'
        elif level == 'Major':
            pool = f'Major月眉_{row["time_slot"]}'
        else:
            pool = '未分池'
        pool_names.append(pool)
    df['pool_name'] = pool_names
    return df


# ========================================================
# 分隊核心
# ========================================================
def choose_smallest_team(teams: Dict[int, List[dict]]) -> int:
    counts = {i: len(members) for i, members in teams.items()}
    min_count = min(counts.values())
    candidates = [i for i, c in counts.items() if c == min_count]
    return random.choice(candidates)


def add_group_to_team(
    group_df: pd.DataFrame,
    target_idx: int,
    teams: Dict[int, List[dict]],
    assigned_ids: set,
    family_team_map: Dict[str, int],
    twin_team_map: Dict[str, int],
    coach_team_map: Dict[str, int],
) -> None:
    for _, row in group_df.iterrows():
        record = row.to_dict()
        teams[target_idx].append(record)
        assigned_ids.add(str(row['player_id']))

        fam = norm_text(row.get('family_id_key', ''))
        twin = norm_text(row.get('twin_group_key', ''))
        coach = norm_text(row.get('coach_group_id', ''))
        if fam:
            family_team_map[fam] = target_idx
        if twin:
            twin_team_map[twin] = target_idx
        if coach:
            coach_team_map[coach] = target_idx


def find_existing_team_for_group(
    group_df: pd.DataFrame,
    family_team_map: Dict[str, int],
    twin_team_map: Dict[str, int],
    coach_team_map: Dict[str, int],
    use_family_follow: bool,
) -> Optional[int]:
    # 教練搭檔最優先
    for coach in group_df['coach_group_id'].dropna().astype(str).tolist():
        coach = norm_text(coach)
        if coach and coach in coach_team_map:
            return coach_team_map[coach]

    # 雙胞胎/同年級同家庭推估群組
    for twin in group_df['twin_group_key'].dropna().astype(str).tolist():
        twin = norm_text(twin)
        if twin and twin in twin_team_map:
            return twin_team_map[twin]

    # U8 規則：低年級若哥哥姊姊已在某隊，自動跟隊
    if use_family_follow:
        for fam in group_df['family_id_key'].dropna().astype(str).tolist():
            fam = norm_text(fam)
            if fam and fam in family_team_map:
                return family_team_map[fam]

    return None


def make_binding_key(row: pd.Series, use_family: bool) -> str:
    coach = norm_text(row.get('coach_group_id', ''))
    if coach:
        return f'COACH::{coach}'
    twin = norm_text(row.get('twin_group_key', ''))
    if twin:
        return f'TWIN::{twin}'
    if use_family:
        fam = norm_text(row.get('family_id_key', ''))
        if fam:
            return f'FAMILY::{fam}'
    return f'PLAYER::{row["player_id"]}'


def assign_groups_balanced(
    df_batch: pd.DataFrame,
    teams: Dict[int, List[dict]],
    assigned_ids: set,
    family_team_map: Dict[str, int],
    twin_team_map: Dict[str, int],
    coach_team_map: Dict[str, int],
    use_family_follow: bool,
    use_family_as_group: bool,
) -> None:
    if df_batch.empty:
        return

    df_batch = df_batch.copy()
    df_batch['binding_key'] = df_batch.apply(lambda r: make_binding_key(r, use_family_as_group), axis=1)
    group_keys = df_batch['binding_key'].drop_duplicates().tolist()
    random.shuffle(group_keys)

    for key in group_keys:
        group_df = df_batch[df_batch['binding_key'] == key]
        target = find_existing_team_for_group(group_df, family_team_map, twin_team_map, coach_team_map, use_family_follow)
        if target is None:
            target = choose_smallest_team(teams)
        add_group_to_team(group_df, target, teams, assigned_ids, family_team_map, twin_team_map, coach_team_map)


def finalize_team_dataframe(teams: Dict[int, List[dict]], prefix: str, start_code: int = 0) -> pd.DataFrame:
    rows = []
    for team_index, members in teams.items():
        team_id = make_team_id(prefix, start_code, team_index)
        for record in members:
            row = record.copy()
            row['p_team_id'] = team_id
            rows.append(row)
    return pd.DataFrame(rows)


def assign_u8(df_pool: pd.DataFrame, prefix: str = 'U8', start_code: int = 0) -> pd.DataFrame:
    n = len(df_pool)
    num_teams = calculate_team_count(n)
    if num_teams == 0:
        return pd.DataFrame()

    teams = {i: [] for i in range(num_teams)}
    assigned_ids = set()
    family_team_map: Dict[str, int] = {}
    twin_team_map: Dict[str, int] = {}
    coach_team_map: Dict[str, int] = {}

    df = df_pool.copy()

    # 3a. 教練/助理教練群組先放，coach_group_id 相同者同隊
    coach_df = df[df['coach_group_id'].astype(str).str.strip() != '']
    if not coach_df.empty:
        assign_groups_balanced(
            coach_df,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=True,
            use_family_as_group=True,
        )

    # 3b~3f. 二舊、二新、一舊、一新、大班舊/新、中班、小班
    for grade, is_new_flag in U8_SEQUENCE:
        batch = df[
            (df['grade'] == grade)
            & (df['is_new'] == is_new_flag)
            & (~df['player_id'].astype(str).isin(assigned_ids))
        ]
        assign_groups_balanced(
            batch,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=True,
            use_family_as_group=True,
        )

    # 保險：未涵蓋年級也分掉
    remaining = df[~df['player_id'].astype(str).isin(assigned_ids)]
    if not remaining.empty:
        add_warning('U8 未預期年級', f'U8 有 {len(remaining)} 筆不在預設年級序列，已最後補分')
        assign_groups_balanced(
            remaining,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=True,
            use_family_as_group=True,
        )

    return finalize_team_dataframe(teams, prefix, start_code)


def assign_ordered_balanced(
    df_pool: pd.DataFrame,
    prefix: str,
    start_code: int = 0,
    use_grade_new_order: bool = True,
    use_family_as_group: bool = False,
) -> pd.DataFrame:
    n = len(df_pool)
    num_teams = calculate_team_count(n)
    if num_teams == 0:
        return pd.DataFrame()

    teams = {i: [] for i in range(num_teams)}
    assigned_ids = set()
    family_team_map: Dict[str, int] = {}
    twin_team_map: Dict[str, int] = {}
    coach_team_map: Dict[str, int] = {}

    df = df_pool.copy()

    # 教練群組先放
    coach_df = df[df['coach_group_id'].astype(str).str.strip() != '']
    if not coach_df.empty:
        assign_groups_balanced(
            coach_df,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=False,
            use_family_as_group=use_family_as_group,
        )

    if use_grade_new_order:
        for rank in sorted(df['grade_rank'].unique(), reverse=True):
            for is_new_flag in [False, True]:
                batch = df[
                    (df['grade_rank'] == rank)
                    & (df['is_new'] == is_new_flag)
                    & (~df['player_id'].astype(str).isin(assigned_ids))
                ]
                assign_groups_balanced(
                    batch,
                    teams,
                    assigned_ids,
                    family_team_map,
                    twin_team_map,
                    coach_team_map,
                    use_family_follow=False,
                    use_family_as_group=use_family_as_group,
                )
    else:
        remaining = df[~df['player_id'].astype(str).isin(assigned_ids)]
        assign_groups_balanced(
            remaining,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=False,
            use_family_as_group=use_family_as_group,
        )

    remaining = df[~df['player_id'].astype(str).isin(assigned_ids)]
    if not remaining.empty:
        assign_groups_balanced(
            remaining,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=False,
            use_family_as_group=use_family_as_group,
        )

    return finalize_team_dataframe(teams, prefix, start_code)


def assign_special_pool(df_special: pd.DataFrame, prefix: str, start_code: int = 0) -> pd.DataFrame:
    """中大特別組：補人後也使用年級/新舊生平衡分隊。"""
    n = len(df_special)
    teams_needed, _, note = special_team_count_and_target(n)
    if teams_needed <= 0:
        return pd.DataFrame()

    # 特別組若剛好 11-15 仍指定一隊；若大於 15 依規則至少兩隊
    # 使用一般排序分隊即可，但隊數要尊重 teams_needed，不能只看 ceil(n/15) 時被改掉。
    teams = {i: [] for i in range(teams_needed)}
    assigned_ids = set()
    family_team_map: Dict[str, int] = {}
    twin_team_map: Dict[str, int] = {}
    coach_team_map: Dict[str, int] = {}
    df = df_special.copy()

    coach_df = df[df['coach_group_id'].astype(str).str.strip() != '']
    if not coach_df.empty:
        assign_groups_balanced(
            coach_df,
            teams,
            assigned_ids,
            family_team_map,
            twin_team_map,
            coach_team_map,
            use_family_follow=False,
            use_family_as_group=False,
        )

    for rank in sorted(df['grade_rank'].unique(), reverse=True):
        for is_new_flag in [False, True]:
            batch = df[
                (df['grade_rank'] == rank)
                & (df['is_new'] == is_new_flag)
                & (~df['player_id'].astype(str).isin(assigned_ids))
            ]
            assign_groups_balanced(
                batch,
                teams,
                assigned_ids,
                family_team_map,
                twin_team_map,
                coach_team_map,
                use_family_follow=False,
                use_family_as_group=False,
            )

    df_out = finalize_team_dataframe(teams, prefix, start_code)
    if not df_out.empty:
        df_out['special_rule_note'] = note
    return df_out


# ========================================================
# 中大特別組抽補流程
# ========================================================
def supplement_special_groups(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    for level in ['Minor', 'Major']:
        special_mask = (df['level'] == level) & (df['is_ncu_special'])
        n_initial = int(special_mask.sum())
        if n_initial == 0:
            continue

        teams_needed, target_count, note = special_team_count_and_target(n_initial)
        add_warning('特別組人數', f'{level} 中大特別組初始 {n_initial} 人：{note}')

        need = max(0, target_count - n_initial)
        if need <= 0:
            continue

        candidate_mask = (
            (df['level'] == level)
            & (~df['is_ncu_special'])
            & (df['field'] == '月眉')
            & (df['apply_ncu_draw'])
        )
        candidates = df[candidate_mask].copy()
        if candidates.empty:
            add_warning('特別組補人不足', f'{level} 中大特別組需補 {need} 人，但沒有月眉 apply_ncu_draw 候選人')
            continue

        selected_n = min(need, len(candidates))
        selected_idx = random.sample(list(candidates.index), selected_n)
        df.loc[selected_idx, 'is_ncu_special'] = True
        df.loc[selected_idx, 'ncu_draw_selected'] = True
        df.loc[selected_idx, 'field'] = '中大'
        df.loc[selected_idx, 'time_slot'] = '週日上午'
        df.loc[selected_idx, 'special_reason'] = df.loc[selected_idx, 'special_reason'].astype(str) + '；抽中大補人'
        df.loc[selected_idx, 'review_note'] = df.loc[selected_idx, 'review_note'].astype(str) + '抽中大補人；'

        add_warning('特別組補人', f'{level} 中大特別組需補 {need} 人，實際抽出 {selected_n} 人')
        if selected_n < need:
            add_warning('特別組補人不足', f'{level} 中大特別組候選人不足，仍缺 {need - selected_n} 人')

    return df


# ========================================================
# 驗證與匯出
# ========================================================
def clean_output_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    最終分隊輸出欄位清理。

    注意：程式內部仍會使用 pool_name、field、is_new、is_ncu_special 等輔助欄位進行分隊與驗證，
    但寫入各分隊 sheet 時，只保留 FINAL_OUTPUT_COLUMNS 指定欄位。
    """
    if df.empty:
        return pd.DataFrame(columns=FINAL_OUTPUT_COLUMNS)

    df2 = df.copy()
    for col in FINAL_OUTPUT_COLUMNS:
        if col not in df2.columns:
            df2[col] = ''

    return df2[FINAL_OUTPUT_COLUMNS]


def validate_results(df_active: pd.DataFrame, results: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows = []
    if not results:
        rows.append({'check': '是否有產出', 'status': 'FAIL', 'detail': '沒有任何分隊結果'})
        return pd.DataFrame(rows)

    combined = pd.concat(results.values(), ignore_index=True) if results else pd.DataFrame()
    active_ids = set(df_active[df_active['pool_name'] != '未分池']['player_id'].astype(str))
    assigned_ids = combined['player_id'].astype(str).tolist() if 'player_id' in combined.columns else []
    assigned_set = set(assigned_ids)

    missing = sorted(active_ids - assigned_set)
    duplicated = sorted([pid for pid in assigned_set if assigned_ids.count(pid) > 1])

    rows.append({'check': '漏分隊', 'status': 'PASS' if not missing else 'FAIL', 'detail': ', '.join(missing)})
    rows.append({'check': '重複分隊', 'status': 'PASS' if not duplicated else 'FAIL', 'detail': ', '.join(duplicated)})

    if not combined.empty:
        # 隊伍人數
        team_sizes = combined.groupby('p_team_id')['player_id'].count().reset_index(name='count')
        for _, r in team_sizes.iterrows():
            status = 'PASS' if MIN_PLAYERS_PER_TEAM <= r['count'] <= MAX_PLAYERS_PER_TEAM else 'WARN'
            rows.append({'check': f'隊伍人數 {r["p_team_id"]}', 'status': status, 'detail': int(r['count'])})

        # team_id 不應跨 pool 重複
        team_pool_counts = combined.groupby('p_team_id')['pool_name'].nunique().reset_index(name='pool_count')
        dup_team_pool = team_pool_counts[team_pool_counts['pool_count'] > 1]
        rows.append({
            'check': 'p_team_id 跨池重複',
            'status': 'PASS' if dup_team_pool.empty else 'FAIL',
            'detail': ', '.join(dup_team_pool['p_team_id'].astype(str).tolist()),
        })

        # 教練 group 是否分裂
        coach_df = combined[combined['coach_group_id'].astype(str).str.strip() != '']
        split_coach = []
        if not coach_df.empty:
            chk = coach_df.groupby('coach_group_id')['p_team_id'].nunique()
            split_coach = chk[chk > 1].index.astype(str).tolist()
        rows.append({'check': 'coach_group_id 同隊', 'status': 'PASS' if not split_coach else 'FAIL', 'detail': ', '.join(split_coach)})

        # twin 是否分裂
        twin_df = combined[combined['twin_group_key'].astype(str).str.strip() != '']
        split_twin = []
        if not twin_df.empty:
            chk = twin_df.groupby('twin_group_key')['p_team_id'].nunique()
            split_twin = chk[chk > 1].index.astype(str).tolist()
        rows.append({'check': 'twin_group 同隊', 'status': 'PASS' if not split_twin else 'FAIL', 'detail': ', '.join(split_twin)})

        # 時段/場地規則
        rule_violations = []
        for _, row in combined.iterrows():
            level, grade, ts, field = row['level'], row['grade'], row['time_slot'], row['field']
            ok = True
            if level == 'U8':
                ok = (ts == '週日上午' and field == '中大')
            elif grade in {'七年級', '八年級', '九年級'}:
                ok = (ts == '週日上午' and field == '大潭')
            elif level == 'Minor' and row.get('is_ncu_special', False):
                ok = (ts == '週日上午' and field == '中大')
            elif level == 'Minor':
                ok = (field == '月眉' and ts in {'週六上午', '週六下午'})
            elif level == 'Major' and row.get('is_ncu_special', False):
                ok = (ts == '週日上午' and field == '中大')
            elif level == 'Major':
                ok = (field == '月眉' and ts in {'週日上午', '週日下午'})
            if not ok:
                rule_violations.append(str(row['player_id']))
        rows.append({'check': '層級/時段/場地規則', 'status': 'PASS' if not rule_violations else 'FAIL', 'detail': ', '.join(rule_violations)})

    return pd.DataFrame(rows)


def make_summary(results: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows = []
    for sheet_name, df in results.items():
        if df.empty:
            continue
        for team_id, team_df in df.groupby('p_team_id'):
            rows.append({
                'sheet': sheet_name,
                'pool_name': team_df['pool_name'].iloc[0] if 'pool_name' in team_df.columns else '',
                'p_team_id': team_id,
                'players': len(team_df),
                'levels': ', '.join(sorted(team_df['level'].dropna().astype(str).unique())),
                'grades': ', '.join(sorted(team_df['grade'].dropna().astype(str).unique(), key=get_grade_rank, reverse=True)),
                'time_slot': team_df['time_slot'].iloc[0] if 'time_slot' in team_df.columns else '',
                'field': team_df['field'].iloc[0] if 'field' in team_df.columns else '',
            })
    return pd.DataFrame(rows)


# ========================================================
# 主流程
# ========================================================
def main() -> None:
    warnings_log.clear()

    if RANDOM_SEED is not None:
        random.seed(RANDOM_SEED)
        np.random.seed(RANDOM_SEED)

    print('=== 讀取資料 ===')
    df_raw = load_input()
    print(f'原始資料：{len(df_raw)} 筆')

    df_raw = ensure_columns(df_raw)
    df_active, df_excluded = filter_inactive_rows(df_raw)
    df = standardize_data(df_active)
    df = mark_special_groups(df)
    df = normalize_time_and_field(df)

    # 特別組可能抽中大補人，抽完後要重新標準化 pool
    df = supplement_special_groups(df)
    df = normalize_time_and_field(df)
    df = assign_pool_name(df)

    print('\n=== 分池統計 ===')
    print(df['pool_name'].value_counts(dropna=False))

    results: Dict[str, pd.DataFrame] = {}

    # U8
    u8_pool = df[df['pool_name'] == 'U8_中大'].copy()
    if not u8_pool.empty:
        print(f'\n[U8] 中大：{len(u8_pool)} 人')
        results['U8_中大'] = assign_u8(u8_pool, prefix='U8', start_code=0)

    # J13 / J15
    for pool_name, prefix in [('J13_大潭', 'J13'), ('J15_大潭', 'J15')]:
        pool = df[df['pool_name'] == pool_name].copy()
        if not pool.empty:
            print(f'\n[{prefix}] 大潭：{len(pool)} 人')
            results[pool_name] = assign_ordered_balanced(pool, prefix=prefix, start_code=0, use_grade_new_order=False, use_family_as_group=False)

    # Minor / Major 特別組，固定從 A 開始；之後一般組接續字母
    cursors = {'Minor': 0, 'Major': 0}
    for level, prefix, pool_name in [('Minor', 'Minor', 'Minor中大特別'), ('Major', 'Major', 'Major中大特別')]:
        pool = df[df['pool_name'] == pool_name].copy()
        if not pool.empty:
            n = len(pool)
            teams_needed, target_count, note = special_team_count_and_target(n)
            if n < target_count:
                add_warning('特別組未達目標人數', f'{level} 中大特別組目前 {n} 人，目標 {target_count} 人；仍會先產生分隊表')
            print(f'\n[{level}] 中大特別組：{n} 人，{teams_needed} 隊，{note}')
            results[pool_name] = assign_special_pool(pool, prefix=prefix, start_code=0)
            cursors[level] = teams_needed

    # Minor / Major 月眉一般組：接續特別組隊名字母，依時段分池
    general_pools = [p for p in df['pool_name'].dropna().unique().tolist() if p.startswith('Minor月眉_') or p.startswith('Major月眉_')]

    def pool_sort_key(pool_name: str) -> int:
        if pool_name.startswith('Minor月眉_'):
            ts = pool_name.replace('Minor月眉_', '')
            return GENERAL_POOL_ORDER.get(('Minor', '月眉', ts), 999)
        if pool_name.startswith('Major月眉_'):
            ts = pool_name.replace('Major月眉_', '')
            return GENERAL_POOL_ORDER.get(('Major', '月眉', ts), 999)
        return 999

    for pool_name in sorted(general_pools, key=pool_sort_key):
        pool = df[df['pool_name'] == pool_name].copy()
        if pool.empty:
            continue
        if pool_name.startswith('Minor'):
            level = 'Minor'
            prefix = 'Minor'
        else:
            level = 'Major'
            prefix = 'Major'
        start_code = cursors[level]
        team_count = calculate_team_count(len(pool))
        print(f'\n[{pool_name}]：{len(pool)} 人，{team_count} 隊，從 {team_letter(start_code)} 開始')
        results[pool_name] = assign_ordered_balanced(pool, prefix=prefix, start_code=start_code, use_grade_new_order=True, use_family_as_group=False)
        cursors[level] += team_count

    # 未分池
    unpooled = df[df['pool_name'] == '未分池'].copy()
    if not unpooled.empty:
        add_warning('未分池', f'有 {len(unpooled)} 筆資料無法分池，請檢查 grade/level')
        results['未分池_需確認'] = unpooled

    # 驗證
    validation_df = validate_results(df, results)
    summary_df = make_summary(results)
    warnings_df = pd.DataFrame(warnings_log)
    if warnings_df.empty:
        warnings_df = pd.DataFrame([{'category': '無', 'message': '沒有警告', 'player_id': '', 'detail': ''}])

    print('\n=== 驗證結果 ===')
    print(validation_df)

    # 匯出
    output_path = os.path.join(BASE_DIR, OUTPUT_FILENAME)
    used_sheet_names = set()
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        # 分隊結果 sheets：最終只保留 FINAL_OUTPUT_COLUMNS 指定欄位
        for name, res_df in results.items():
            sheet = safe_sheet_name(name, used_sheet_names)
            clean_output_columns(res_df).to_excel(writer, sheet_name=sheet, index=False)

        # 除錯用 sheets 預設不輸出，避免最終 Excel 出現非指定欄位。
        # 若需要檢查漏分、隊伍人數、警告紀錄，請把 INCLUDE_DIAGNOSTIC_SHEETS 改成 True。
        if INCLUDE_DIAGNOSTIC_SHEETS:
            validation_df.to_excel(writer, sheet_name=safe_sheet_name('Validation', used_sheet_names), index=False)
            summary_df.to_excel(writer, sheet_name=safe_sheet_name('Summary', used_sheet_names), index=False)
            warnings_df.to_excel(writer, sheet_name=safe_sheet_name('Warnings', used_sheet_names), index=False)
            df.to_excel(writer, sheet_name=safe_sheet_name('Normalized_Input', used_sheet_names), index=False)
            if not df_excluded.empty:
                df_excluded.to_excel(writer, sheet_name=safe_sheet_name('Excluded', used_sheet_names), index=False)

    print(f'\n 檔案已建立：{output_path}')


if __name__ == '__main__':
    main()
