#!/usr/bin/env python3
"""
浏览器操作 HTTP Server
提供 RESTful API 来执行浏览器操作，避免通过 stdout 传递大量数据
"""

import json
import os
import sys
import signal
import time
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading

# 尝试导入内容提取库
try:
    import trafilatura
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False

try:
    import html2text
    HTML2TEXT_AVAILABLE = True
except ImportError:
    HTML2TEXT_AVAILABLE = False

try:
    from markdownify import markdownify as md
    MARKDOWNIFY_AVAILABLE = True
except ImportError:
    MARKDOWNIFY_AVAILABLE = False

from playwright.sync_api import sync_playwright

# 全局变量存储浏览器实例
browser_instance = None
playwright_instance = None
browser_context = None
browser_page = None
server_port = None
workspace_root = None
state_file_path = None


class BrowserRequestHandler(BaseHTTPRequestHandler):
    """处理浏览器操作请求"""

    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        """处理 POST 请求"""
        try:
            # 解析路径
            parsed_path = urlparse(self.path)
            endpoint = parsed_path.path

            # 读取请求体
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body.decode("utf-8")) if body else {}

            # 根据端点路由
            if endpoint == "/extract-content":
                response = self.handle_extract_content(request_data)
            elif endpoint == "/navigate":
                response = self.handle_navigate(request_data)
            elif endpoint == "/click":
                response = self.handle_click(request_data)
            elif endpoint == "/type":
                response = self.handle_type(request_data)
            elif endpoint == "/screenshot":
                response = self.handle_screenshot(request_data)
            elif endpoint == "/scroll":
                response = self.handle_scroll(request_data)
            elif endpoint == "/health":
                response = {"success": True, "status": "healthy"}
            else:
                response = {"success": False, "error": f"Unknown endpoint: {endpoint}"}

            # 发送响应
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode("utf-8"))

        except Exception as e:
            error_response = {"success": False, "error": str(e)}
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(error_response, ensure_ascii=False).encode("utf-8"))

    def handle_extract_content(self, data):
        """处理提取内容请求"""
        global browser_page, workspace_root

        try:
            selector = data.get("selector")
            extract_type = data.get("extractType", "markdown")
            current_url = data.get("currentUrl")

            # 确保页面已加载
            page = self.ensure_page(current_url)
            if not page:
                return {"success": False, "error": "Failed to get page"}

            # 如果提供了 current_url，确保页面已导航到该 URL
            if current_url:
                try:
                    # 等待页面加载完成
                    page.wait_for_load_state("domcontentloaded", timeout=20000)
                    try:
                        page.wait_for_load_state("load", timeout=8000)
                    except:
                        pass
                    # 额外等待，确保动态内容已加载
                    page.wait_for_timeout(2000)
                except:
                    pass

            # 获取当前页面信息
            current_page_url = page.url
            try:
                current_page_title = page.title()
            except:
                current_page_title = ""

            # 提取内容
            if selector:
                element_locator = page.locator(selector).first
                try:
                    count = element_locator.count()
                    if count == 0:
                        return {
                            "success": False,
                            "error": f"Element not found: {selector}",
                        }
                except:
                    pass

                try:
                    if extract_type == "html":
                        content = element_locator.inner_html(timeout=5000)
                    elif extract_type == "markdown":
                        html_content = element_locator.inner_html(timeout=5000)
                        if html_content and HTML2TEXT_AVAILABLE:
                            h = html2text.HTML2Text()
                            h.ignore_links = False
                            h.ignore_images = False
                            h.body_width = 0
                            content = h.handle(html_content)
                        elif html_content and MARKDOWNIFY_AVAILABLE:
                            content = md(html_content)
                        else:
                            content = element_locator.inner_text(timeout=5000)
                    else:
                        html_content = element_locator.inner_html(timeout=5000)
                        if html_content and TRAFILATURA_AVAILABLE:
                            try:
                                extracted = trafilatura.extract(
                                    html_content,
                                    include_comments=False,
                                    include_tables=True,
                                )
                                if extracted and len(extracted.strip()) > 0:
                                    content = extracted
                                else:
                                    content = element_locator.inner_text(timeout=5000)
                            except:
                                content = element_locator.inner_text(timeout=5000)
                        else:
                            content = element_locator.inner_text(timeout=5000)

                    if content is None:
                        content = ""
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Failed to extract content from element {selector}: {str(e)}",
                    }
            else:
                # 提取整个页面
                if extract_type == "html":
                    content = page.content()
                elif extract_type == "markdown":
                    html_content = page.content()
                    if html_content and HTML2TEXT_AVAILABLE:
                        try:
                            h = html2text.HTML2Text()
                            h.ignore_links = False
                            h.ignore_images = False
                            h.body_width = 0
                            h.unicode_snob = True
                            content = h.handle(html_content)
                        except:
                            if MARKDOWNIFY_AVAILABLE:
                                content = md(html_content)
                            else:
                                content = page.locator("body").inner_text(timeout=10000) or ""
                    elif html_content and MARKDOWNIFY_AVAILABLE:
                        content = md(html_content)
                    else:
                        content = page.locator("body").inner_text(timeout=10000) or ""
                else:
                    html_content = page.content()
                    if html_content and TRAFILATURA_AVAILABLE:
                        try:
                            extracted = trafilatura.extract(
                                html_content,
                                include_comments=False,
                                include_tables=True,
                                include_images=False,
                                include_links=True,
                                output_format="text",
                            )
                            if extracted and len(extracted.strip()) > 0:
                                content = extracted
                            else:
                                content = page.locator("body").inner_text(timeout=10000) or ""
                        except:
                            content = page.locator("body").inner_text(timeout=10000) or ""
                    else:
                        try:
                            body_locator = page.locator("body")
                            body_locator.wait_for(state="attached", timeout=5000)
                            content = body_locator.inner_text(timeout=10000) or ""
                        except:
                            content = ""

            if content is None:
                content = ""
            else:
                content = str(content)

            # 保存到文件
            content_size = len(content.encode("utf-8")) if content else 0
            content_file = os.path.join(workspace_root, f"content-{os.urandom(8).hex()}.txt")

            try:
                with open(content_file, "w", encoding="utf-8") as f:
                    f.write(content)
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Failed to save content to file: {str(e)}",
                }

            # 返回结果
            is_blank_page = current_page_url == "about:blank" or (not content or len(content.strip()) == 0)

            return {
                "success": True,
                "contentFile": content_file,
                "contentType": extract_type,
                "contentSize": content_size,
                "debug": {
                    "pageUrl": current_page_url,
                    "pageTitle": current_page_title,
                    "hasContent": not is_blank_page,
                    "contentLength": len(content) if content else 0,
                    "isBlankPage": current_page_url == "about:blank",
                },
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def handle_navigate(self, data):
        """处理导航请求"""
        global browser_page

        try:
            url = data.get("url")
            wait_until = data.get("waitUntil", "load")
            timeout = data.get("timeout", 30000)

            page = self.ensure_page()
            if not page:
                return {"success": False, "error": "Failed to get page"}

            page.goto(url, wait_until=wait_until, timeout=timeout)
            title = page.title()

            # 保存状态
            self.save_state()

            return {
                "success": True,
                "url": page.url,
                "title": title,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def handle_click(self, data):
        """处理点击请求"""
        global browser_page

        try:
            selector = data.get("selector")
            timeout = data.get("timeout", 10000)

            page = self.ensure_page()
            if not page:
                return {"success": False, "error": "Failed to get page"}

            page.wait_for_selector(selector, timeout=timeout)
            page.click(selector)

            # 保存状态
            self.save_state()

            return {"success": True, "url": page.url}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def handle_type(self, data):
        """处理输入请求"""
        global browser_page

        try:
            selector = data.get("selector")
            text = data.get("text")
            timeout = data.get("timeout", 10000)

            page = self.ensure_page()
            if not page:
                return {"success": False, "error": "Failed to get page"}

            page.wait_for_selector(selector, timeout=timeout)
            page.fill(selector, text)

            # 保存状态
            self.save_state()

            return {"success": True, "url": page.url}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def handle_screenshot(self, data):
        """处理截图请求"""
        global browser_page, workspace_root

        try:
            full_page = data.get("fullPage", False)
            format_type = data.get("format", "png")

            page = self.ensure_page()
            if not page:
                return {"success": False, "error": "Failed to get page"}

            screenshot_bytes = page.screenshot(full_page=full_page, type=format_type)

            # 保存到文件
            screenshot_file = os.path.join(workspace_root, f"screenshot-{os.urandom(8).hex()}.{format_type}")
            with open(screenshot_file, "wb") as f:
                f.write(screenshot_bytes)

            return {
                "success": True,
                "screenshotFile": screenshot_file,
                "format": format_type,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def handle_scroll(self, data):
        """处理滚动请求"""
        global browser_page

        try:
            x = data.get("x", 0)
            y = data.get("y", 0)

            page = self.ensure_page()
            if not page:
                return {"success": False, "error": "Failed to get page"}

            page.evaluate(f"window.scrollTo({x}, {y})")

            return {"success": True, "url": page.url}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def ensure_page(self, current_url=None):
        """确保页面可用"""
        global browser_page, browser_context, browser_instance, playwright_instance

        if browser_page:
            # 如果提供了 current_url，检查是否需要导航
            if current_url:
                try:
                    page_url = browser_page.url
                    # 如果是空白页或 URL 不匹配，需要导航
                    if page_url == "about:blank" or page_url != current_url:
                        browser_page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                        # 等待页面加载完成
                        browser_page.wait_for_load_state("domcontentloaded", timeout=20000)
                        try:
                            browser_page.wait_for_load_state("load", timeout=8000)
                        except:
                            pass
                        # 额外等待，确保动态内容已加载
                        browser_page.wait_for_timeout(2000)
                except Exception as e:
                    # 导航失败，记录错误但继续
                    import sys
                    sys.stderr.write(f"Warning: Failed to navigate to {current_url}: {str(e)}\n")
            return browser_page

        # 如果没有页面，尝试连接或创建浏览器
        if not playwright_instance:
            playwright_instance = sync_playwright().start()
            p = playwright_instance

            # 尝试从环境变量或配置获取 ws_endpoint
            ws_endpoint = os.environ.get("WS_ENDPOINT")
            if ws_endpoint:
                try:
                    browser_instance = p.chromium.connect_over_cdp(ws_endpoint)
                    contexts = browser_instance.contexts
                    if contexts:
                        browser_context = contexts[0]
                        pages = browser_context.pages
                        if pages:
                            browser_page = pages[0]
                except:
                    pass

            # 如果连接失败，启动新浏览器
            if not browser_instance or not browser_page:
                browser_instance = p.chromium.launch(headless=True)
                browser_context = browser_instance.new_context()

                # 恢复状态
                if state_file_path:
                    try:
                        with open(state_file_path, "r") as f:
                            state = json.load(f)
                            if "cookies" in state:
                                browser_context.add_cookies(state["cookies"])
                    except:
                        pass

                browser_page = browser_context.new_page()

                # 如果提供了 current_url，导航到该 URL
                if current_url:
                    try:
                        browser_page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                        browser_page.wait_for_load_state("domcontentloaded", timeout=20000)
                        try:
                            browser_page.wait_for_load_state("load", timeout=8000)
                        except:
                            pass
                        browser_page.wait_for_timeout(2000)
                    except Exception as e:
                        import sys
                        sys.stderr.write(f"Warning: Failed to navigate to {current_url} on new page: {str(e)}\n")

        return browser_page

    def save_state(self):
        """保存浏览器状态"""
        global browser_context, state_file_path

        if browser_context and state_file_path:
            try:
                cookies = browser_context.cookies()
                state = {"cookies": cookies}
                with open(state_file_path, "w") as f:
                    json.dump(state, f)
            except:
                pass

    def log_message(self, format, *args):
        """禁用默认日志输出"""
        pass


def signal_handler(signum, frame):
    """处理退出信号"""
    global browser_instance, playwright_instance
    if browser_instance:
        try:
            browser_instance.close()
        except:
            pass
    if playwright_instance:
        try:
            playwright_instance.stop()
        except:
            pass
    sys.exit(0)


def main():
    """主函数"""
    global server_port, workspace_root, state_file_path

    # 从命令行参数读取配置
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing config JSON"}))
        sys.exit(1)

    try:
        config = json.loads(sys.argv[1])
        server_port = config.get("port", 8888)
        workspace_root = config.get("workspaceRoot", "/tmp")
        state_file_path = config.get("stateFilePath")
        ws_endpoint = config.get("wsEndpoint")

        # 设置环境变量供后续使用
        if ws_endpoint:
            os.environ["WS_ENDPOINT"] = ws_endpoint

        # 确保 workspace_root 存在
        os.makedirs(workspace_root, exist_ok=True)

        # 注册信号处理
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)

        # 启动 HTTP 服务器
        server = HTTPServer(("0.0.0.0", server_port), BrowserRequestHandler)
        print(json.dumps({"success": True, "port": server_port}), file=sys.stderr)
        sys.stderr.flush()

        # 运行服务器
        server.serve_forever()

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.stderr.flush()
        sys.exit(1)


if __name__ == "__main__":
    main()
