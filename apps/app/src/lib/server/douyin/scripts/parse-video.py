#!/usr/bin/env python3
"""
抖音视频解析脚本
使用 yt-dlp 解析抖音视频信息
"""
import json
import sys
import os
import subprocess

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    error_msg = json.dumps({"success": False, "error": "Missing config JSON"})
    sys.stdout.write(error_msg + "\n")
    sys.stdout.flush()
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    url = config.get("url")
    workspace_root = config.get("workspaceRoot", "/tmp")

    if not url:
        error_msg = json.dumps({"success": False, "error": "Missing URL"})
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # 检查 yt-dlp 是否已安装
    try:
        subprocess.run(["yt-dlp", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        # 尝试安装 yt-dlp
        sys.stderr.write("yt-dlp not found, installing...\n")
        install_result = subprocess.run(
            ["pip3", "install", "--user", "yt-dlp"],
            capture_output=True,
            text=True,
        )
        if install_result.returncode != 0:
            error_msg = json.dumps({
                "success": False,
                "error": f"Failed to install yt-dlp: {install_result.stderr}",
            })
            sys.stdout.write(error_msg + "\n")
            sys.stdout.flush()
            sys.exit(1)

    # 使用 yt-dlp 获取视频信息（不下载）
    sys.stderr.write(f"Fetching video info for: {url}\n")
    info_result = subprocess.run(
        [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-warnings",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    if info_result.returncode != 0:
        error_msg = json.dumps({
            "success": False,
            "error": f"Failed to fetch video info: {info_result.stderr or info_result.stdout}",
        })
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # 解析 JSON 输出
    try:
        video_info = json.loads(info_result.stdout)
    except json.JSONDecodeError as e:
        error_msg = json.dumps({
            "success": False,
            "error": f"Failed to parse video info JSON: {str(e)}",
        })
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # 提取视频信息
    result_data = {
        "success": True,
        "videoId": video_info.get("id", ""),
        "title": video_info.get("title", ""),
        "description": video_info.get("description", ""),
        "author": {
            "name": video_info.get("uploader", ""),
            "id": video_info.get("uploader_id", ""),
            "avatar": video_info.get("uploader_avatar", ""),
        },
        "videoUrl": "",
        "coverUrl": video_info.get("thumbnail", ""),
        "duration": video_info.get("duration"),
        "stats": {
            "likeCount": video_info.get("like_count"),
            "commentCount": video_info.get("comment_count"),
            "viewCount": video_info.get("view_count"),
        },
        "publishTime": video_info.get("timestamp") and str(video_info.get("timestamp")),
    }

    # 获取视频 URL（优先选择最高质量的视频）
    formats = video_info.get("formats", [])
    if formats:
        # 查找视频格式（排除音频）
        video_formats = [f for f in formats if f.get("vcodec") != "none"]
        if video_formats:
            # 按质量排序，选择最高质量的
            video_formats.sort(key=lambda x: x.get("height", 0) or 0, reverse=True)
            result_data["videoUrl"] = video_formats[0].get("url", "")
        else:
            # 如果没有纯视频格式，使用第一个格式
            result_data["videoUrl"] = formats[0].get("url", "")

    # 如果没有找到视频 URL，尝试使用 video_info 中的 url
    if not result_data["videoUrl"]:
        result_data["videoUrl"] = video_info.get("url", "")

    # 输出 JSON 结果
    result = json.dumps(result_data, ensure_ascii=False)
    result_bytes = (result + "\n").encode("utf-8")

    # 分块写入，避免阻塞
    chunk_size = 8192
    for i in range(0, len(result_bytes), chunk_size):
        chunk = result_bytes[i : i + chunk_size]
        sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()

except subprocess.TimeoutExpired:
    error_msg = json.dumps({"success": False, "error": "Request timeout"})
    sys.stdout.write(error_msg + "\n")
    sys.stdout.flush()
    sys.exit(1)
except Exception as e:
    sys.stderr.flush()
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result + "\n")
    sys.stdout.flush()
    sys.exit(1)
