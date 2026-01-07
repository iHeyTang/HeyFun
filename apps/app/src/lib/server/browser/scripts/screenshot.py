#!/usr/bin/env python3
"""
浏览器截图脚本
对页面进行截图
"""
import json
import sys
import os
import base64
from playwright.sync_api import sync_playwright

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    print(json.dumps({"success": False, "error": "Missing config JSON"}))
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    ws_endpoint = config.get("wsEndpoint")
    state_file_path = config.get("stateFilePath")
    current_url = config.get("currentUrl")
    full_page = config.get("fullPage", False)
    format_type = config.get("format", "png")

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

            # 导航到当前 URL（如果有）
            if current_url:
                page.goto(current_url)

        # 截图
        screenshot = page.screenshot(full_page=full_page, type=format_type)

        # 将截图保存到临时文件（而不是 base64 编码后通过 stdout 传输）
        workspace_root = config.get("workspaceRoot", "/tmp")
        file_extension = format_type if format_type in ["png", "jpeg"] else "png"
        screenshot_file = os.path.join(
            workspace_root, f"screenshot-{os.urandom(8).hex()}.{file_extension}"
        )
        with open(screenshot_file, "wb") as f:
            f.write(screenshot)

        # 只在非 CDP 连接时关闭浏览器（CDP 连接时浏览器应该保持运行）
        if not ws_endpoint:
            browser.close()

        # 返回文件路径而不是 base64 数据
        result = json.dumps(
            {
                "success": True,
                "screenshotFile": screenshot_file,  # 返回文件路径
                "format": format_type,
            }
        )
        print(result)
except Exception as e:
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result)
    sys.stdout.flush()
    sys.exit(1)
