#!/usr/bin/env python3
"""
抖音视频下载脚本
使用 yt-dlp 下载抖音视频
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
    quality = config.get("quality", "highest")

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

    # 生成输出文件名
    output_template = os.path.join(workspace_root, "douyin-video-%(id)s.%(ext)s")

    # 构建 yt-dlp 命令
    yt_dlp_cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "-o",
        output_template,
    ]

    # 根据质量选择格式
    if quality == "highest":
        yt_dlp_cmd.extend(["-f", "best"])
    elif quality == "high":
        yt_dlp_cmd.extend(["-f", "best[height<=1080]"])
    elif quality == "medium":
        yt_dlp_cmd.extend(["-f", "best[height<=720]"])
    elif quality == "low":
        yt_dlp_cmd.extend(["-f", "worst"])

    yt_dlp_cmd.append(url)

    # 下载视频
    sys.stderr.write(f"Downloading video from: {url}\n")
    download_result = subprocess.run(
        yt_dlp_cmd,
        capture_output=True,
        text=True,
        timeout=300,  # 5 分钟超时
    )

    if download_result.returncode != 0:
        error_msg = json.dumps({
            "success": False,
            "error": f"Failed to download video: {download_result.stderr or download_result.stdout}",
        })
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # 获取视频信息（用于返回文件名等）
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

    video_info = {}
    if info_result.returncode == 0:
        try:
            video_info = json.loads(info_result.stdout)
        except json.JSONDecodeError:
            pass

    # 查找下载的文件
    video_id = video_info.get("id", "unknown")
    video_ext = video_info.get("ext", "mp4")
    downloaded_file = os.path.join(workspace_root, f"douyin-video-{video_id}.{video_ext}")

    # 如果文件不存在，尝试查找任何匹配的文件
    if not os.path.exists(downloaded_file):
        # 查找所有 douyin-video- 开头的文件
        for file in os.listdir(workspace_root):
            if file.startswith("douyin-video-"):
                downloaded_file = os.path.join(workspace_root, file)
                break

    if not os.path.exists(downloaded_file):
        error_msg = json.dumps({
            "success": False,
            "error": "Downloaded file not found",
        })
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # 获取文件信息
    file_size = os.path.getsize(downloaded_file)
    file_name = os.path.basename(downloaded_file)

    result_data = {
        "success": True,
        "videoId": video_info.get("id", ""),
        "title": video_info.get("title", ""),
        "author": {
            "name": video_info.get("uploader", ""),
            "id": video_info.get("uploader_id", ""),
        },
        "downloadFile": downloaded_file,
        "fileName": file_name,
        "fileSize": file_size,
        "videoUrl": video_info.get("url", ""),
        "coverUrl": video_info.get("thumbnail", ""),
    }

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
    error_msg = json.dumps({"success": False, "error": "Download timeout"})
    sys.stdout.write(error_msg + "\n")
    sys.stdout.flush()
    sys.exit(1)
except Exception as e:
    sys.stderr.flush()
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result + "\n")
    sys.stdout.flush()
    sys.exit(1)
