#!/usr/bin/env python3
"""
浏览器提取内容脚本
从页面中提取指定元素或整个页面的内容，并转换为LLM友好的格式
"""
import json
import sys
import os
from playwright.sync_api import sync_playwright

# 尝试导入内容提取库
try:
    import trafilatura
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False
    sys.stderr.write("Warning: trafilatura not available, falling back to basic extraction\n")

try:
    import html2text
    HTML2TEXT_AVAILABLE = True
except ImportError:
    HTML2TEXT_AVAILABLE = False
    sys.stderr.write("Warning: html2text not available, markdown conversion disabled\n")

try:
    from markdownify import markdownify as md
    MARKDOWNIFY_AVAILABLE = True
except ImportError:
    MARKDOWNIFY_AVAILABLE = False

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
    extract_type = config.get("extractType", "markdown")
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
                elif extract_type == "markdown":
                    # 对于 markdown，先获取 HTML，然后转换
                    html_content = element_locator.inner_html(timeout=5000)
                    if html_content and HTML2TEXT_AVAILABLE:
                        h = html2text.HTML2Text()
                        h.ignore_links = False
                        h.ignore_images = False
                        h.body_width = 0  # 不换行
                        content = h.handle(html_content)
                    elif html_content and MARKDOWNIFY_AVAILABLE:
                        content = md(html_content)
                    else:
                        # 回退到纯文本
                        content = element_locator.inner_text(timeout=5000)
                else:
                    # text 类型：尝试使用 trafilatura 提取主要内容
                    html_content = element_locator.inner_html(timeout=5000)
                    if html_content and TRAFILATURA_AVAILABLE:
                        try:
                            # 使用 trafilatura 提取主要内容
                            extracted = trafilatura.extract(html_content, include_comments=False, include_tables=True)
                            if extracted and len(extracted.strip()) > 0:
                                content = extracted
                                sys.stderr.write(f"Extracted {len(content)} chars using trafilatura\n")
                            else:
                                # trafilatura 提取失败，回退到 inner_text
                                content = element_locator.inner_text(timeout=5000)
                                sys.stderr.write("Trafilatura extraction returned empty, using inner_text\n")
                        except Exception as e:
                            sys.stderr.write(f"Trafilatura extraction failed: {str(e)}, using inner_text\n")
                            content = element_locator.inner_text(timeout=5000)
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
            elif extract_type == "markdown":
                # 提取为 Markdown 格式
                html_content = page.content()
                if html_content and HTML2TEXT_AVAILABLE:
                    try:
                        h = html2text.HTML2Text()
                        h.ignore_links = False
                        h.ignore_images = False
                        h.body_width = 0  # 不换行
                        h.unicode_snob = True  # 保留 Unicode 字符
                        content = h.handle(html_content)
                        sys.stderr.write(f"Converted {len(content)} chars to markdown using html2text\n")
                    except Exception as e:
                        sys.stderr.write(f"html2text conversion failed: {str(e)}, trying markdownify\n")
                        if MARKDOWNIFY_AVAILABLE:
                            try:
                                content = md(html_content)
                                sys.stderr.write(f"Converted {len(content)} chars to markdown using markdownify\n")
                            except Exception as e2:
                                sys.stderr.write(f"markdownify conversion failed: {str(e2)}, using inner_text\n")
                                content = page.locator("body").inner_text(timeout=10000) or ""
                        else:
                            content = page.locator("body").inner_text(timeout=10000) or ""
                elif html_content and MARKDOWNIFY_AVAILABLE:
                    try:
                        content = md(html_content)
                        sys.stderr.write(f"Converted {len(content)} chars to markdown using markdownify\n")
                    except Exception as e:
                        sys.stderr.write(f"markdownify conversion failed: {str(e)}, using inner_text\n")
                        content = page.locator("body").inner_text(timeout=10000) or ""
                else:
                    # 回退到纯文本
                    content = page.locator("body").inner_text(timeout=10000) or ""
            else:
                # text 类型：使用 trafilatura 提取主要内容
                html_content = page.content()
                content = ""

                if html_content and TRAFILATURA_AVAILABLE:
                    try:
                        # 使用 trafilatura 提取主要内容（去除导航、广告等噪音）
                        extracted = trafilatura.extract(
                            html_content,
                            include_comments=False,
                            include_tables=True,
                            include_images=False,  # 不包含图片描述，减少噪音
                            include_links=True,   # 保留链接
                            output_format="text",  # 纯文本输出
                        )
                        if extracted and len(extracted.strip()) > 0:
                            content = extracted
                            sys.stderr.write(f"Extracted {len(content)} chars using trafilatura\n")
                        else:
                            # trafilatura 提取失败，回退到基本方法
                            sys.stderr.write("Trafilatura extraction returned empty, using fallback\n")
                            content = page.locator("body").inner_text(timeout=10000) or ""
                    except Exception as e:
                        sys.stderr.write(f"Trafilatura extraction failed: {str(e)}, using fallback\n")
                        content = page.locator("body").inner_text(timeout=10000) or ""
                else:
                    # trafilatura 不可用，使用基本方法
                    try:
                        body_exists = page.evaluate("() => document.body !== null")
                        if not body_exists:
                            sys.stderr.write("Warning: document.body is null\n")
                            content = ""
                        else:
                            body_locator = page.locator("body")
                            body_locator.wait_for(state="attached", timeout=5000)
                            content = body_locator.inner_text(timeout=10000) or ""
                            sys.stderr.write(f"Extracted {len(content)} chars using locator\n")
                    except Exception as e:
                        sys.stderr.write(f"Error extracting content: {str(e)}\n")
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

        # 如果内容很大（超过 50KB），保存到文件；否则直接返回
        # 降低阈值以避免 JSON 序列化后过大导致 stdout 写入阻塞
        content_size = len(content.encode("utf-8")) if content else 0
        max_content_size = 50 * 1024  # 50KB，JSON 序列化后可能达到 70-80KB
        
        # 预先检查 JSON 大小，如果序列化后可能超过 100KB，也保存到文件
        result_data = {
            "success": True,
            "content": None,  # 先设为 None，后面根据大小决定
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

        # 决定是否保存到文件
        should_save_to_file = content_size > max_content_size
        
        if should_save_to_file:
            # 保存到临时文件
            workspace_root = config.get("workspaceRoot", "/tmp")
            content_file = os.path.join(
                workspace_root, f"content-{os.urandom(8).hex()}.txt"
            )
            try:
                with open(content_file, "w", encoding="utf-8") as f:
                    f.write(content)
                result_data["contentFile"] = content_file
                # 不包含 content 字段，减少 JSON 大小
            except Exception as e:
                sys.stderr.write(f"Warning: Failed to save content to file: {str(e)}\n")
                # 如果保存文件失败，尝试包含内容（可能失败，但至少尝试）
                result_data["content"] = content
        else:
            # 小内容直接包含在 JSON 中
            result_data["content"] = content
            
            # 额外检查：如果 JSON 序列化后可能太大，也保存到文件
            try:
                test_json = json.dumps(result_data)
                if len(test_json.encode("utf-8")) > 100 * 1024:  # JSON 超过 100KB
                    sys.stderr.write(f"Warning: JSON size ({len(test_json)} bytes) exceeds 100KB, saving to file instead\n")
                    workspace_root = config.get("workspaceRoot", "/tmp")
                    content_file = os.path.join(
                        workspace_root, f"content-{os.urandom(8).hex()}.txt"
                    )
                    with open(content_file, "w", encoding="utf-8") as f:
                        f.write(content)
                    result_data["contentFile"] = content_file
                    del result_data["content"]
            except Exception as e:
                sys.stderr.write(f"Warning: Failed to test JSON size: {str(e)}\n")

        # 在输出 JSON 之前，确保 stderr 已刷新（避免调试信息混入 stdout）
        sys.stderr.flush()

        # 输出 JSON 结果（确保是唯一的 stdout 输出）
        # 使用更安全的方式写入，分块写入以避免阻塞
        try:
            result = json.dumps(result_data, ensure_ascii=False)
            result_bytes = (result + "\n").encode("utf-8")
            
            # 分块写入，避免一次性写入大量数据导致阻塞
            chunk_size = 8192  # 8KB chunks
            for i in range(0, len(result_bytes), chunk_size):
                chunk = result_bytes[i:i + chunk_size]
                sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()
        except (IOError, OSError) as e:
            # 如果写入失败，尝试使用文本模式
            sys.stderr.write(f"Warning: Binary write failed: {str(e)}, trying text mode\n")
            try:
                result = json.dumps(result_data, ensure_ascii=False)
                sys.stdout.write(result + "\n")
                sys.stdout.flush()
            except Exception as e2:
                # 最后的回退：只返回基本信息，不包含内容
                error_result = json.dumps({
                    "success": False,
                    "error": f"Failed to write result to stdout: {str(e2)}",
                    "contentSize": content_size,
                    "contentFile": result_data.get("contentFile"),
                })
                sys.stdout.write(error_result + "\n")
                sys.stdout.flush()
                sys.exit(1)
except Exception as e:
    # 确保错误信息只输出到 stdout
    sys.stderr.flush()  # 先刷新 stderr
    error_result = json.dumps({"success": False, "error": str(e)})
    sys.stdout.write(error_result + "\n")
    sys.stdout.flush()
    sys.exit(1)
