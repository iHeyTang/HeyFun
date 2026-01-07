#!/usr/bin/env python3
"""
检查浏览器状态脚本
通过 CDP 端点获取浏览器信息
"""
import json
import sys
import requests
import socket
import time

# 从命令行参数读取配置 JSON
if len(sys.argv) < 2:
    print(json.dumps({"success": False, "error": "Missing config JSON"}))
    sys.exit(1)

try:
    config = json.loads(sys.argv[1])
    debug_port = config.get("debugPort")
    browser_id = config.get("browserId")
    max_retries = config.get("maxRetries", 3)
    retry_delay = config.get("retryDelay", 2)
    cdp_host = config.get("cdpHost", "localhost")  # 支持自定义主机名（用于 previewUrl）

    if not debug_port:
        print(json.dumps({"success": False, "error": "debugPort is required"}))
        sys.exit(1)

    # 检查端口是否可访问
    def check_port_open(host, port, timeout=1):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except Exception as e:
            return False

    # 尝试多次连接（浏览器可能需要时间启动）
    last_error = None
    for attempt in range(max_retries):
        try:
            # 先检查端口是否开放
            if not check_port_open(cdp_host, debug_port, timeout=1):
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                else:
                    print(
                        json.dumps(
                            {
                                "success": False,
                                "error": f"Port {debug_port} is not accessible on {cdp_host}",
                                "debugPort": debug_port,
                                "cdpHost": cdp_host,
                                "attempts": attempt + 1,
                            }
                        )
                    )
                    sys.exit(1)

            # 尝试连接 CDP 端点
            cdp_url = f"http://{cdp_host}:{debug_port}/json"
            response = requests.get(cdp_url, timeout=3)

            if response.status_code == 200:
                pages = response.json()
                ws_endpoint = pages[0]["webSocketDebuggerUrl"] if pages else None

                print(
                    json.dumps(
                        {
                            "success": True,
                            "browserId": browser_id,
                            "wsEndpoint": ws_endpoint,
                            "debugPort": debug_port,
                            "pagesCount": len(pages) if pages else 0,
                        }
                    )
                )
                sys.exit(0)
            else:
                last_error = f"HTTP {response.status_code}: {response.text[:200]}"
        except requests.exceptions.ConnectionError as e:
            last_error = f"Connection refused: {str(e)}"
        except requests.exceptions.Timeout as e:
            last_error = f"Request timeout: {str(e)}"
        except Exception as e:
            last_error = f"Unexpected error: {str(e)}"

        # 如果不是最后一次尝试，等待后重试
        if attempt < max_retries - 1:
            time.sleep(retry_delay)

    # 所有尝试都失败了
    print(
        json.dumps(
            {
                "success": False,
                "error": f"Failed to connect to browser after {max_retries} attempts: {last_error}",
                "debugPort": debug_port,
                "cdpHost": cdp_host,
                "attempts": max_retries,
            }
        )
    )
    sys.exit(1)
except Exception as e:
    print(
        json.dumps(
            {
                "success": False,
                "error": f"Script error: {str(e)}",
                "type": type(e).__name__,
            }
        )
    )
    sys.exit(1)
