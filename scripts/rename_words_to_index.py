#!/usr/bin/env python3
"""
把 words 目录下的 word_0001.wav, word_0002.wav ... 重命名为 0.wav, 1.wav, ...

用法:
  uv run rename_words_to_index.py [目录]
  默认目录为脚本所在目录下的 words
"""

import argparse
import re
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="将 word_XXXX.wav 重命名为 0.wav, 1.wav, ...")
    parser.add_argument(
        "dir",
        type=Path,
        nargs="?",
        default=Path(__file__).resolve().parent / "words",
        help="目标目录，默认 ./words",
    )
    args = parser.parse_args()

    dir_path = args.dir.resolve()
    if not dir_path.is_dir():
        raise SystemExit(f"目录不存在: {dir_path}")

    # 匹配 word_数字.wav 或 word_数字.扩展名
    pattern = re.compile(r"^word_(\d+)\.(\w+)$", re.IGNORECASE)
    files: list[tuple[int, Path, str]] = []
    for f in dir_path.iterdir():
        if not f.is_file():
            continue
        m = pattern.match(f.name)
        if m:
            num = int(m.group(1))
            ext = m.group(2)
            files.append((num, f, ext))

    if not files:
        print(f"未找到 word_*.wav 等文件: {dir_path}")
        return

    files.sort(key=lambda x: x[0])
    print(f"共 {len(files)} 个文件，将重命名为 0.{files[0][2]}, 1.{files[0][2]}, ...")

    # 先重命名为临时名，再改为最终名，避免覆盖
    for i, (_, path, ext) in enumerate(files):
        path.rename(dir_path / f"__tmp_{i}.{ext}")
    for i, (_, _, ext) in enumerate(files):
        (dir_path / f"__tmp_{i}.{ext}").rename(dir_path / f"{i}.{ext}")

    print("完成。")


if __name__ == "__main__":
    main()
