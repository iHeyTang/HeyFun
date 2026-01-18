#!/usr/bin/env python3
"""
批量移除工具中的 context.workflow.run 调用
"""

import re
import sys
from pathlib import Path

def remove_workflow_run(file_path: Path):
    """移除文件中的 workflow.run 调用"""
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        
        # 模式1: return await context.workflow.run(`...`, async () => {
        # 替换为直接执行
        pattern1 = r'return await context\.workflow\.run\(`[^`]+`, async \(\) => \{'
        replacement1 = '# 直接执行，不再使用 workflow.run'
        content = re.sub(pattern1, replacement1, content)
        
        # 模式2: await context.workflow.run(`...`, async () => {
        pattern2 = r'await context\.workflow\.run\(`[^`]+`, async \(\) => \{'
        replacement2 = '# 直接执行，不再使用 workflow.run'
        content = re.sub(pattern2, replacement2, content)
        
        # 移除对应的闭合括号 }); 但需要小心处理嵌套
        # 简单处理：移除独立的 }); 行（前面只有空白）
        lines = content.split('\n')
        new_lines = []
        skip_next_close = False
        
        for i, line in enumerate(lines):
            # 如果上一行是替换后的注释，跳过下一个 });
            if i > 0 and '# 直接执行，不再使用 workflow.run' in lines[i-1]:
                skip_next_close = True
                new_lines.append(line)
                continue
            
            # 如果是独立的 }); 行且需要跳过
            if skip_next_close and re.match(r'^\s*\}\);?\s*$', line):
                skip_next_close = False
                continue
            
            new_lines.append(line)
        
        content = '\n'.join(new_lines)
        
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            print(f"✓ Processed: {file_path}")
            return True
        else:
            print(f"- No changes: {file_path}")
            return False
    except Exception as e:
        print(f"✗ Error processing {file_path}: {e}")
        return False

def main():
    # 查找所有包含 context.workflow.run 的工具文件
    tools_dir = Path('apps/app/src/agents/tools')
    
    if not tools_dir.exists():
        print(f"Error: {tools_dir} does not exist")
        sys.exit(1)
    
    files = list(tools_dir.rglob('*.ts'))
    files_with_workflow = []
    
    for file in files:
        try:
            content = file.read_text(encoding='utf-8')
            if 'context.workflow.run' in content:
                files_with_workflow.append(file)
        except:
            pass
    
    print(f"Found {len(files_with_workflow)} files with context.workflow.run")
    print()
    
    processed = 0
    for file in files_with_workflow:
        if remove_workflow_run(file):
            processed += 1
    
    print()
    print(f"Processed {processed} files")
    print("Please review the changes and fix any remaining issues manually.")

if __name__ == '__main__':
    main()
