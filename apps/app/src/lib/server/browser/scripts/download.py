#!/usr/bin/env python3
"""
浏览器下载脚本
从当前页面下载指定 URL 的资源
"""
import json
import sys
import os
from playwright.sync_api import sync_playwright
from urllib.parse import urljoin, urlparse

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    error_msg = json.dumps({"success": False, "error": "Missing config JSON"})
    sys.stdout.write(error_msg + "\n")
    sys.stdout.flush()
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    ws_endpoint = config.get("wsEndpoint")
    state_file_path = config.get("stateFilePath")
    download_url = config.get("url")
    timeout = config.get("timeout", 60000)
    current_url = config.get("currentUrl")
    workspace_root = config.get("workspaceRoot", "/tmp")

    if not download_url:
        error_msg = json.dumps({"success": False, "error": "Missing download URL"})
        sys.stdout.write(error_msg + "\n")
        sys.stdout.flush()
        sys.exit(1)

    with sync_playwright() as p:
        browser = None
        context = None
        page = None

        # 尝试连接到已运行的浏览器
        connected_via_cdp = False
        if ws_endpoint:
            try:
                browser = p.chromium.connect_over_cdp(ws_endpoint)
                contexts = browser.contexts
                if contexts:
                    context = contexts[0]
                    pages = context.pages
                    if pages:
                        page = pages[0]
                        connected_via_cdp = True
            except Exception as e:
                sys.stderr.write(f"Failed to connect via CDP: {str(e)}\n")
                pass

        # 如果连接失败，启动新浏览器（sandbox 环境必须使用 headless 模式）
        if not browser or not page:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(accept_downloads=True)
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
                page.goto(current_url, wait_until="domcontentloaded", timeout=30000)

        # 获取当前页面URL
        current_page_url = page.url

        # 关键修复：跨 workflow 执行时，必须确保页面在正确的 URL
        if connected_via_cdp and current_url:
            current_url_normalized = current_page_url.split("#")[0].rstrip("/")
            target_url_normalized = current_url.split("#")[0].rstrip("/")

            if (
                current_page_url == "about:blank"
                or current_url_normalized != target_url_normalized
            ):
                sys.stderr.write(
                    f"[Cross-Workflow] Current URL ({current_page_url}) doesn't match target ({current_url}), navigating...\n"
                )
                try:
                    page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                    current_page_url = page.url
                except Exception as e:
                    sys.stderr.write(
                        f"[Cross-Workflow] Failed to navigate to {current_url}: {str(e)}\n"
                    )

        # 确保页面已加载
        try:
            page.wait_for_load_state("domcontentloaded", timeout=20000)
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to wait for page load: {str(e)}\n")

        # 解析下载 URL（可能是相对 URL）
        if not download_url.startswith(("http://", "https://")):
            # 相对 URL，需要基于当前页面 URL 解析
            download_url = urljoin(current_page_url, download_url)

        sys.stderr.write(f"Downloading from URL: {download_url}\n")

        # 设置下载路径
        download_file_name = os.path.basename(urlparse(download_url).path) or "download"
        download_path = os.path.join(
            workspace_root, f"download-{os.urandom(8).hex()}-{download_file_name}"
        )

        # 等待下载完成
        try:
            with page.expect_download(timeout=timeout) as download_info:
                # 方法1: 尝试直接导航到下载 URL
                try:
                    page.goto(
                        download_url, wait_until="domcontentloaded", timeout=timeout
                    )
                except Exception as e:
                    sys.stderr.write(
                        f"Direct navigation failed: {str(e)}, trying alternative methods\n"
                    )
                    # 方法2: 尝试查找并点击下载链接
                    try:
                        # 尝试多种选择器
                        selectors = [
                            f'a[href="{download_url}"]',
                            f'a[href*="{download_url.split("/")[-1]}"]',
                            f'a[href*="{os.path.basename(download_url)}"]',
                        ]
                        clicked = False
                        for selector in selectors:
                            try:
                                link = page.locator(selector).first
                                if link.count() > 0:
                                    link.click(timeout=5000)
                                    clicked = True
                                    break
                            except:
                                continue

                        if not clicked:
                            # 方法3: 使用 JavaScript 触发下载
                            page.evaluate(f'window.location.href = "{download_url}"')
                    except Exception as e2:
                        sys.stderr.write(
                            f"Alternative download methods failed: {str(e2)}\n"
                        )
                        # 最后尝试：直接使用 JavaScript 创建下载链接
                        page.evaluate(
                            f"""
                            const link = document.createElement("a");
                            link.href = "{download_url}";
                            link.download = "";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        """
                        )
        except Exception as e:
            error_msg = json.dumps(
                {
                    "success": False,
                    "error": f"Failed to trigger download: {str(e)}",
                }
            )
            sys.stderr.flush()
            sys.stdout.write(error_msg + "\n")
            sys.stdout.flush()
            sys.exit(1)

        download = download_info.value

        # 保存下载的文件
        try:
            download.save_as(download_path)
            sys.stderr.write(f"Download saved to: {download_path}\n")
        except Exception as e:
            error_msg = json.dumps(
                {
                    "success": False,
                    "error": f"Failed to save download: {str(e)}",
                }
            )
            sys.stderr.flush()
            sys.stdout.write(error_msg + "\n")
            sys.stdout.flush()
            sys.exit(1)

        # 获取文件信息
        file_size = (
            os.path.getsize(download_path) if os.path.exists(download_path) else 0
        )
        suggested_filename = download.suggested_filename

        # 保存状态（只在非 CDP 连接时）
        if not ws_endpoint and state_file_path:
            cookies = context.cookies()
            state = {"cookies": cookies}
            with open(state_file_path, "w") as f:
                json.dump(state, f)
            browser.close()

        result_data = {
            "success": True,
            "downloadFile": download_path,
            "fileName": suggested_filename or download_file_name,
            "fileSize": file_size,
            "url": download_url,
            "debug": {
                "pageUrl": current_page_url,
                "suggestedFilename": suggested_filename,
            },
        }

        # 在输出 JSON 之前，确保 stderr 已刷新
        sys.stderr.flush()

        # 输出 JSON 结果
        result = json.dumps(result_data, ensure_ascii=False)
        result_bytes = (result + "\n").encode("utf-8")

        # 分块写入，避免阻塞
        chunk_size = 8192
        for i in range(0, len(result_bytes), chunk_size):
            chunk = result_bytes[i : i + chunk_size]
            sys.stdout.buffer.write(chunk)
        sys.stdout.buffer.flush()

except Exception as e:
    sys.stderr.flush()
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result + "\n")
    sys.stdout.flush()
    sys.exit(1)
