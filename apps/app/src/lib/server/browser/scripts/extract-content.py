#!/usr/bin/env python3
"""
浏览器提取内容脚本
从页面中提取指定元素或整个页面的内容
"""
import json
import sys
import os
from playwright.sync_api import sync_playwright

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
    selector = config.get("selector")
    extract_type = config.get("extractType", "text")
    current_url = config.get("currentUrl")

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
                page.goto(current_url, wait_until="domcontentloaded", timeout=30000)

        # 获取当前页面URL
        current_page_url = page.url

        # 关键修复：跨 workflow 执行时，必须确保页面在正确的 URL
        # 由于导航和提取内容在不同的 Edge Function workflow 中执行，
        # 需要通过 CDP 连接时验证并同步页面状态
        if connected_via_cdp and current_url:
            # 检查当前URL是否与目标URL匹配（忽略hash和末尾的斜杠）
            current_url_normalized = current_page_url.split("#")[0].rstrip("/")
            target_url_normalized = current_url.split("#")[0].rstrip("/")

            # 如果当前是空白页或URL不匹配，需要导航
            if (
                current_page_url == "about:blank"
                or current_url_normalized != target_url_normalized
            ):
                sys.stderr.write(
                    f"[Cross-Workflow] Current URL ({current_page_url}) doesn't match target ({current_url}), navigating...\n"
                )
                try:
                    # 导航到目标 URL，等待加载完成
                    page.goto(current_url, wait_until="domcontentloaded", timeout=30000)
                    current_page_url = page.url
                    sys.stderr.write(
                        f"[Cross-Workflow] Successfully navigated to {current_page_url}\n"
                    )
                except Exception as e:
                    sys.stderr.write(
                        f"[Cross-Workflow] Failed to navigate to {current_url}: {str(e)}\n"
                    )
                    # 即使导航失败，也继续尝试提取内容（可能页面已经在正确的 URL）

        # 确保页面已加载并稳定（跨 workflow 场景需要更长的等待时间）
        try:
            # 等待DOM加载（跨 workflow 可能需要更长时间）
            page.wait_for_load_state("domcontentloaded", timeout=20000)
            # 尝试等待完全加载
            try:
                page.wait_for_load_state("load", timeout=8000)
            except:
                pass
            # 额外等待，确保动态内容已加载（特别是SPA应用和跨 workflow 场景）
            # 跨 Edge Function 执行时，页面可能还在异步加载内容
            page.wait_for_timeout(5000)
            sys.stderr.write(
                f"[Cross-Workflow] Page load wait completed, current URL: {page.url}\n"
            )
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to wait for page load: {str(e)}\n")
            # 即使等待失败，也继续尝试提取内容

        # 获取当前页面URL和标题用于调试
        current_page_url = page.url
        try:
            current_page_title = page.title()
        except:
            current_page_title = ""

        if selector:
            element_locator = page.locator(selector).first
            # 检查元素是否存在
            try:
                count = element_locator.count()
                if count == 0:
                    error_msg = json.dumps(
                        {"success": False, "error": f"Element not found: {selector}"}
                    )
                    sys.stderr.flush()  # 确保 stderr 先刷新
                    sys.stdout.write(error_msg + "\n")
                    sys.stdout.flush()
                    sys.exit(1)
            except Exception as e:
                # count失败,尝试直接获取内容来验证元素存在
                sys.stderr.write(f"Warning: Failed to count elements: {str(e)}\n")

            # 提取内容（inner_text和inner_html会自动等待元素）
            try:
                if extract_type == "html":
                    content = element_locator.inner_html(timeout=5000)
                else:
                    content = element_locator.inner_text(timeout=5000)

                if content is None:
                    content = ""
            except Exception as e:
                error_msg = json.dumps(
                    {
                        "success": False,
                        "error": f"Failed to extract content from element {selector}: {str(e)}",
                    }
                )
                sys.stderr.flush()  # 确保 stderr 先刷新
                sys.stdout.write(error_msg + "\n")
                sys.stdout.flush()
                sys.exit(1)
        else:
            # 没有选择器，提取整个页面内容
            if extract_type == "html":
                content = page.content()
                if content is None:
                    content = ""
            else:
                # 提取文本内容 - 使用最可靠的方法
                content = ""

                # 首先检查页面是否有内容
                try:
                    body_exists = page.evaluate("() => document.body !== null")
                    if not body_exists:
                        sys.stderr.write("Warning: document.body is null\n")
                        content = ""
                    else:
                        # 方法1: 直接使用 Playwright 的 locator（最可靠）
                        try:
                            body_locator = page.locator("body")
                            # 等待body元素可见
                            body_locator.wait_for(state="attached", timeout=5000)
                            content = body_locator.inner_text(timeout=10000)
                            if content is None:
                                content = ""
                            sys.stderr.write(
                                f"Extracted {len(content)} chars using locator\n"
                            )
                        except Exception as e:
                            sys.stderr.write(f"Locator method failed: {str(e)}\n")
                            # 方法2: 使用 evaluate 提取 body 的文本
                            try:
                                content = page.evaluate(
                                    """() => {
                                    if (!document.body) return '';
                                    // 移除script和style标签内容
                                    const scripts = document.body.querySelectorAll('script, style, noscript');
                                    scripts.forEach(el => el.remove());
                                    // 获取文本
                                    const text = document.body.innerText || document.body.textContent || '';
                                    return text.trim();
                                }"""
                                )
                                if content is None:
                                    content = ""
                                sys.stderr.write(
                                    f"Extracted {len(content)} chars using evaluate\n"
                                )
                            except Exception as e2:
                                sys.stderr.write(f"Evaluate method failed: {str(e2)}\n")
                                # 方法3: 获取所有可见文本节点
                                try:
                                    content = page.evaluate(
                                        """() => {
                                        if (!document.body) return '';
                                        const walker = document.createTreeWalker(
                                            document.body,
                                            NodeFilter.SHOW_TEXT,
                                            {
                                                acceptNode: function(node) {
                                                    // 跳过script和style标签
                                                    const parent = node.parentElement;
                                                    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
                                                        return NodeFilter.FILTER_REJECT;
                                                    }
                                                    // 只接受非空文本
                                                    if (node.textContent.trim().length === 0) {
                                                        return NodeFilter.FILTER_REJECT;
                                                    }
                                                    return NodeFilter.FILTER_ACCEPT;
                                                }
                                            }
                                        );
                                        let text = '';
                                        let node;
                                        while (node = walker.nextNode()) {
                                            text += node.textContent.trim() + '\\n';
                                        }
                                        return text.trim();
                                    }"""
                                    )
                                    if content is None:
                                        content = ""
                                    sys.stderr.write(
                                        f"Extracted {len(content)} chars using TreeWalker\n"
                                    )
                                except Exception as e3:
                                    sys.stderr.write(
                                        f"TreeWalker method failed: {str(e3)}\n"
                                    )
                                    content = ""
                except Exception as e:
                    sys.stderr.write(f"Error checking page content: {str(e)}\n")
                    content = ""

        # 保存状态（只在非 CDP 连接时）
        if not ws_endpoint and state_file_path:
            cookies = context.cookies()
            state = {"cookies": cookies}
            with open(state_file_path, "w") as f:
                json.dump(state, f)
            browser.close()

        # 确保 content 是字符串
        if content is None:
            content = ""
        else:
            content = str(content)

        # 检查是否真的是空白页
        is_blank_page = current_page_url == "about:blank" or (
            not content or len(content.strip()) == 0
        )

        # 如果内容很大（超过 100KB），保存到文件；否则直接返回
        content_size = len(content.encode("utf-8")) if content else 0
        result_data = {
            "success": True,
            "content": content if content_size <= 100 * 1024 else None,
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

        # 如果是空白页，添加警告
        if is_blank_page:
            result_data["debug"][
                "warning"
            ] = "Page appears to be blank or has no extractable content"

        if content_size > 100 * 1024:  # 100KB
            # 保存到临时文件
            workspace_root = config.get("workspaceRoot", "/tmp")
            content_file = os.path.join(
                workspace_root, f"content-{os.urandom(8).hex()}.txt"
            )
            with open(content_file, "w", encoding="utf-8") as f:
                f.write(content)
            result_data["contentFile"] = content_file
            del result_data["content"]  # 大文件不直接返回内容

        # 在输出 JSON 之前，确保 stderr 已刷新（避免调试信息混入 stdout）
        sys.stderr.flush()

        # 输出 JSON 结果（确保是唯一的 stdout 输出）
        result = json.dumps(result_data)
        # 直接写入 stdout 而不是使用 print，避免额外的换行符
        sys.stdout.write(result + "\n")
        sys.stdout.flush()
except Exception as e:
    # 确保错误信息只输出到 stdout
    sys.stderr.flush()  # 先刷新 stderr
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result + "\n")
    sys.stdout.flush()
    sys.exit(1)
