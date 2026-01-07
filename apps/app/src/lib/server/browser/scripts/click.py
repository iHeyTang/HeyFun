#!/usr/bin/env python3
"""
浏览器点击脚本
点击指定选择器的元素
"""
import json
import sys
from playwright.sync_api import sync_playwright

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    print(json.dumps({"success": False, "error": "Missing config JSON"}))
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    ws_endpoint = config.get("wsEndpoint")
    state_file_path = config.get("stateFilePath")
    selector = config.get("selector")
    timeout = config.get("timeout", 10000)
    current_url = config.get("currentUrl")

    with sync_playwright() as p:
        browser = None
        context = None
        page = None

        # 尝试连接到已运行的浏览器（通过 WebSocket 端点）
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

        # 执行点击操作
        page.wait_for_selector(selector, timeout=timeout)
        page.click(selector)

        # 保存状态（只在非 CDP 连接时保存，CDP 连接时浏览器持续运行）
        if not ws_endpoint and state_file_path:
            cookies = context.cookies()
            state = {"cookies": cookies}
            with open(state_file_path, "w") as f:
                json.dump(state, f)
            browser.close()

        print(json.dumps({"success": True, "clicked": True}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
    sys.exit(1)

