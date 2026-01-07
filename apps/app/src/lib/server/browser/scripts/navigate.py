#!/usr/bin/env python3
"""
浏览器导航脚本
导航到指定 URL 并返回页面信息
"""
import json
import sys
import os
import base64
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    print(json.dumps({"success": False, "error": "Missing config JSON"}))
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    ws_endpoint = config.get("wsEndpoint")
    state_file_path = config.get("stateFilePath")
    url = config.get("url")
    wait_until = config.get("waitUntil", "load")
    timeout = config.get("timeout", 30000)
    current_url = config.get("currentUrl")

    with sync_playwright() as p:
        browser = None
        context = None
        page = None

        # 尝试连接到已运行的浏览器
        if ws_endpoint:
            try:
                browser = p.chromium.connect_over_cdp(ws_endpoint)
                contexts = browser.contexts
                if contexts:
                    context = contexts[0]
                    pages = context.pages
                    if pages:
                        page = pages[0]
            except:
                pass

        # 如果连接失败，启动新浏览器（sandbox 环境必须使用 headless 模式）
        if not browser or not page:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            # 恢复状态
            if state_file_path:
                try:
                    with open(state_file_path, "r") as f:
                        state = json.load(f)
                        if "cookies" in state:
                            context.add_cookies(state["cookies"])
                except:
                    pass

        # 导航到 URL
        page.goto(url, wait_until=wait_until, timeout=timeout)
        title = page.title()
        screenshot = page.screenshot()

        # 将截图保存到临时文件（而不是 base64 编码后通过 stdout 传输）
        workspace_root = config.get("workspaceRoot", "/tmp")
        screenshot_file = os.path.join(
            workspace_root, f"screenshot-{os.urandom(8).hex()}.png"
        )
        with open(screenshot_file, "wb") as f:
            f.write(screenshot)

        # 保存状态（只在非 CDP 连接时）
        if not ws_endpoint and state_file_path:
            cookies = context.cookies()
            state = {"cookies": cookies}
            with open(state_file_path, "w") as f:
                json.dump(state, f)
            browser.close()

        # 返回文件路径而不是 base64 数据
        result = json.dumps(
            {
                "success": True,
                "url": url,
                "title": title,
                "screenshotFile": screenshot_file,  # 返回文件路径
            }
        )
        print(result)
except Exception as e:
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result)
    sys.stdout.flush()
    sys.exit(1)
