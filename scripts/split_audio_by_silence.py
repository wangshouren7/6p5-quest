#!/usr/bin/env python3
"""
按静音切割音频：根据音量判断，有声音的区间视为一个片段（单词），静音处切割。

用法:
  uv run split_audio_by_silence.py <音频文件> [选项]
  uv run split_audio_by_silence.py "01 Test 1-横向测试 .mp3" -o ./words --min-silence-len 500 --silence-thresh -70 --keep-silence 500

依赖: 需要系统安装 ffmpeg（用于 mp3 等格式），macOS: brew install ffmpeg

split_on_silence 全部参数（pydub）:
  - min_silence_len (ms): 连续静音超过多长才切一刀，默认 1000
  - silence_thresh (dBFS): 低于此音量算静音，默认 -16
  - keep_silence (ms | True | False): 每段首尾保留的静音；True=全保留，False=不保留，默认 100
  - seek_step (ms): 检测时的步长，越小越细、越慢，默认 1
"""

import argparse
import re
from pathlib import Path

from pydub import AudioSegment
from pydub.silence import split_on_silence


def sanitize_filename(name: str) -> str:
    """把字符串改成安全的文件名（去掉路径、空格等）。"""
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    return name.strip().replace(" ", "_") or "segment"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="按静音切割音频，每个有声音的区间导出为一个文件（适合连续读单词的音频）"
    )
    parser.add_argument(
        "input",
        type=Path,
        help="输入音频文件路径（支持 mp3, wav, m4a 等）",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=None,
        help="输出目录，默认在输入文件同目录下创建 <文件名>_words",
    )
    parser.add_argument(
        "--min-silence-len",
        type=int,
        default=300,
        help="视为静音的最短长度（毫秒），只有静音超过此时长才切割。默认 300",
    )
    parser.add_argument(
        "--silence-thresh",
        type=int,
        default=-40,
        help="静音阈值（dB），低于此音量视为静音。默认 -40，可尝试 -35～-45",
    )
    parser.add_argument(
        "--keep-silence",
        type=int,
        default=50,
        help="每段前后保留的静音长度（毫秒），避免切得太紧。默认 50；pydub 也支持 True/False",
    )
    parser.add_argument(
        "--seek-step",
        type=int,
        default=1,
        help="静音检测步长（毫秒），越小越精细、越慢。默认 1",
    )
    parser.add_argument(
        "--min-len",
        type=int,
        default=0,
        help="丢弃短于此时长（毫秒）的片段，可过滤杂音。默认 0 不丢弃",
    )
    parser.add_argument(
        "--format",
        choices=("wav", "mp3"),
        default="wav",
        help="输出格式。默认 wav（无损、无额外依赖）",
    )
    args = parser.parse_args()

    input_path = args.input.resolve()
    if not input_path.is_file():
        raise SystemExit(f"文件不存在: {input_path}")

    out_dir = args.output_dir
    if out_dir is None:
        out_dir = input_path.parent / f"{input_path.stem}_words"
    out_dir = out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"加载: {input_path}")
    audio: AudioSegment = AudioSegment.from_file(str(input_path))

    chunks = split_on_silence(
        audio,
        min_silence_len=args.min_silence_len,
        silence_thresh=args.silence_thresh,
        keep_silence=args.keep_silence,
        # seek_step=args.seek_step,
    )

    # 过滤过短的片段
    if args.min_len > 0:
        chunks = [c for c in chunks if len(c) >= args.min_len]

    print(f"共切出 {len(chunks)} 段，输出到: {out_dir}")

    for i, chunk in enumerate(chunks, start=1):
        name = f"word_{i:04d}.{args.format}"
        out_path = out_dir / name
        chunk.export(str(out_path), format=args.format)
        print(f"  {name}  ({len(chunk) / 1000:.2f}s)")

    print("完成。")


if __name__ == "__main__":
    main()
