#!/usr/bin/env python3
"""
浏览器启动脚本
启动浏览器并保持运行
"""
import json
import sys
import time
import signal
import requests
from playwright.sync_api import sync_playwright

# 全局变量，用于在信号处理中访问
playwright_instance = None
browser_instance = None


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


# 注册信号处理
signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    print(json.dumps({"success": False, "error": "Missing config JSON"}))
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    browser_id = config.get("browserId")
    # sandbox 环境默认使用 headless 模式（没有 X server）
    # 确保 headless 参数被正确设置
    headless = config.get("headless")
    if headless is None:
        headless = True  # 默认值
    debug_port = config.get("debugPort")
    info_file_path = config.get("infoFilePath")

    # 记录配置信息（用于调试）
    print(
        json.dumps(
            {
                "config": {
                    "browserId": browser_id,
                    "headless": headless,
                    "debugPort": debug_port,
                }
            }
        ),
        file=sys.stderr,
    )

    # 启动 playwright（不使用 with 语句，避免自动关闭）
    playwright_instance = sync_playwright().start()
    p = playwright_instance

    launch_args = []
    if debug_port:
        # 无论 headless 还是非 headless，都需要启用 CDP 以便外部连接
        launch_args = [
            f"--remote-debugging-port={debug_port}",
            "--disable-blink-features=AutomationControlled",
        ]

    browser_instance = p.chromium.launch(
        headless=headless, args=launch_args if launch_args else None
    )

    # 检查浏览器是否成功启动
    if not browser_instance:
        raise ValueError("Browser failed to start")

    # 等待一小段时间，确保浏览器进程完全启动
    time.sleep(1)

    # 检查浏览器进程是否还在运行（使用 hasattr 安全检查）
    if hasattr(browser_instance, "process") and browser_instance.process:
        if browser_instance.process.poll() is not None:
            exit_code = browser_instance.process.poll()
            raise ValueError(
                f"Browser process exited immediately with code {exit_code}"
            )

    # 获取 WebSocket 端点
    # 如果启用了 CDP，需要通过 CDP 端点获取 WebSocket URL
    # 否则使用 browser 的内置 ws_endpoint（如果有）
    ws_endpoint = None
    if debug_port:
        # 通过 CDP 端点获取 WebSocket URL（需要等待浏览器启动完成）
        max_retries = 20  # 增加重试次数
        retry_delay = 0.5
        last_error = None
        for attempt in range(max_retries):
            # 每次重试前检查浏览器进程是否还在运行（使用 hasattr 安全检查）
            if hasattr(browser_instance, "process") and browser_instance.process:
                if browser_instance.process.poll() is not None:
                    exit_code = browser_instance.process.poll()
                    raise ValueError(
                        f"Browser process exited during startup with code {exit_code}"
                    )

            try:
                cdp_url = f"http://localhost:{debug_port}/json"
                response = requests.get(cdp_url, timeout=2)
                if response.status_code == 200:
                    pages = response.json()
                    # 获取第一个可用的 WebSocket 端点
                    if pages and len(pages) > 0:
                        ws_endpoint = pages[0].get("webSocketDebuggerUrl")
                        if ws_endpoint:
                            break
                    else:
                        # pages 列表为空，可能是浏览器刚启动还没有页面
                        # 尝试创建一个页面，或者直接构建 WebSocket URL
                        # 首先尝试创建一个页面
                        try:
                            # 创建一个新页面来触发 CDP 端点出现
                            context = browser_instance.new_context()
                            page = context.new_page()
                            # 导航到一个空白页面
                            page.goto("about:blank")

                            # 再次检查 CDP 端点
                            response2 = requests.get(cdp_url, timeout=2)
                            if response2.status_code == 200:
                                pages2 = response2.json()
                                if pages2 and len(pages2) > 0:
                                    ws_endpoint = pages2[0].get("webSocketDebuggerUrl")
                                    if ws_endpoint:
                                        break
                        except Exception as create_error:
                            # 创建页面失败，尝试直接构建 WebSocket URL
                            pass

                        # 如果仍然没有 ws_endpoint，尝试直接构建
                        if not ws_endpoint:
                            # 尝试从 /json/version 获取浏览器信息
                            try:
                                version_url = (
                                    f"http://localhost:{debug_port}/json/version"
                                )
                                version_response = requests.get(version_url, timeout=2)
                                if version_response.status_code == 200:
                                    version_info = version_response.json()
                                    # 构建 WebSocket URL（格式：ws://localhost:port/devtools/browser/{browser-id}）
                                    browser_id = (
                                        version_info.get("Browser", "").split("/")[-1]
                                        if version_info.get("Browser")
                                        else ""
                                    )
                                    if browser_id:
                                        ws_endpoint = f"ws://localhost:{debug_port}/devtools/browser/{browser_id}"
                                    else:
                                        # 如果没有 browser ID，使用通用格式
                                        ws_endpoint = f"ws://localhost:{debug_port}/devtools/browser"
                                    if ws_endpoint:
                                        break
                            except Exception as version_error:
                                pass

                        if not ws_endpoint:
                            last_error = "CDP endpoint returned empty pages list and failed to create page or build WebSocket URL"
                else:
                    last_error = f"CDP endpoint returned status {response.status_code}"
            except requests.exceptions.ConnectionError as e:
                last_error = f"Connection refused: {str(e)}"
            except requests.exceptions.Timeout as e:
                last_error = f"Request timeout: {str(e)}"
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"

            # CDP 端点可能还没准备好，等待后重试
            if attempt < max_retries - 1:
                time.sleep(retry_delay)

        # 如果所有重试都失败
        if not ws_endpoint:
            raise ValueError(
                f"Failed to get WebSocket endpoint from CDP after {max_retries} attempts. Last error: {last_error}"
            )

    # 如果仍然没有 ws_endpoint，尝试从 browser 对象获取（某些版本可能支持）
    if not ws_endpoint:
        try:
            ws_endpoint = browser_instance.ws_endpoint
        except AttributeError:
            # browser 对象没有 ws_endpoint 属性
            # 如果没有 debug_port，无法构建有效的 WebSocket URL
            if not debug_port:
                raise ValueError(
                    "Cannot get WebSocket endpoint: no debug_port provided and browser has no ws_endpoint attribute"
                )
            # 如果 CDP 端点获取失败，抛出错误
            raise ValueError(
                "Failed to get WebSocket endpoint from CDP and browser has no ws_endpoint attribute"
            )

    # 保存浏览器信息到文件
    # 获取进程 PID（如果可用）
    pid = None
    if hasattr(browser_instance, "process") and browser_instance.process:
        if hasattr(browser_instance.process, "pid"):
            pid = browser_instance.process.pid

    browser_info = {
        "browserId": browser_id,
        "wsEndpoint": ws_endpoint,
        "debugPort": debug_port,
        "pid": pid,
    }

    if info_file_path:
        with open(info_file_path, "w") as f:
            json.dump(browser_info, f)

    # 保持浏览器运行（等待信号或超时）
    try:
        # 浏览器会一直运行，直到进程被终止
        while True:
            time.sleep(1)
            # 检查浏览器是否还在运行（使用 hasattr 安全检查）
            if hasattr(browser_instance, "process") and browser_instance.process:
                if browser_instance.process.poll() is not None:
                    break
            # 如果没有 process 属性，尝试通过 CDP 端点检查浏览器是否还在运行
            elif debug_port:
                try:
                    cdp_url = f"http://localhost:{debug_port}/json"
                    response = requests.get(cdp_url, timeout=1)
                    if response.status_code != 200:
                        # CDP 端点不可用，浏览器可能已退出
                        break
                except Exception:
                    # CDP 端点不可用，浏览器可能已退出
                    break
    except KeyboardInterrupt:
        pass
    finally:
        if browser_instance:
            browser_instance.close()
        if playwright_instance:
            playwright_instance.stop()
except Exception as e:
    error_msg = str(e)
    print(json.dumps({"success": False, "error": error_msg}), file=sys.stderr)
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
    sys.exit(1)
