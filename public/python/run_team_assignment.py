# -*- coding: utf-8 -*-

import argparse
import os
import shutil
import sys

import team_assignment_core as core


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--team-year", default="2026")
    parser.add_argument("--random-seed", default="42")
    parser.add_argument("--include-diagnostics", default="false")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    input_ext = os.path.splitext(args.input)[1] or ".xlsx"
    working_input_name = f"uploaded_players{input_ext}"
    working_input_path = os.path.join(args.output_dir, working_input_name)

    shutil.copyfile(args.input, working_input_path)

    team_year = int(args.team_year)
    random_seed = None if str(args.random_seed).strip() == "" else int(args.random_seed)

    core.BASE_DIR = args.output_dir
    core.INPUT_FILENAME = working_input_name
    core.INPUT_SHEET_NAME = None
    core.TEAM_YEAR = team_year
    core.OUTPUT_FILENAME = f"Final_Team_Assignments_{team_year}.xlsx"
    core.RANDOM_SEED = random_seed
    core.INCLUDE_DIAGNOSTIC_SHEETS = str(args.include_diagnostics).lower() == "true"

    core.main()

    try:
        os.remove(working_input_path)
    except OSError:
        pass


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)