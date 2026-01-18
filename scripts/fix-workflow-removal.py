#!/usr/bin/env python3
"""
修复移除 workflow.run 后的语法错误
"""

import re
from pathlib import Path

def fix_file(file_path: Path):
    """修复文件中的语法错误"""
    try:
        content = file_path.read_text(encoding='utf-8')
        original_content = content
        
        # 修复模式1: # 直接执行，不再使用 workflow.run 后面缺少代码块开始
        # 查找 "# 直接执行，不再使用 workflow.run" 后面直接跟 try 或其他代码的情况
        content = re.sub(
            r'# 直接执行，不再使用 workflow\.run\s*\n\s*try',
            'try',
            content
        )
        
        # 修复模式2: 移除多余的 }); 在文件末尾
        # 如果最后几行是 }); 且前面有注释，可能是多余的
        lines = content.split('\n')
        if len(lines) > 2:
            # 检查最后两行
            if lines[-1].strip() == '});' and '# 直接执行' in lines[-3] if len(lines) >= 3 else False:
                # 检查是否真的需要这个闭合
                # 简单处理：如果前面有未闭合的括号，保留；否则移除
                pass  # 暂时不自动移除，需要手动检查
        
        # 修复模式3: 修复缺少闭合括号的情况
        # 如果看到 "# 直接执行" 注释，检查后面的代码结构
        content = re.sub(
            r'# 直接执行，不再使用 workflow\.run\s*\n\s*\)\s*;',
            '',
            content
        )
        
        # 修复模式4: 移除注释行中残留的代码
        # 如果注释行包含代码片段，清理它
        lines = content.split('\n')
        new_lines = []
        for i, line in enumerate(lines):
            # 如果这行是注释但包含代码片段，清理
            if '# 直接执行' in line and '=' in line and 'await' in line:
                # 这可能是错误的替换，移除这行
                continue
            new_lines.append(line)
        content = '\n'.join(new_lines)
        
        # 修复模式5: 修复缺少的闭合括号
        # 检查函数定义和闭合括号的匹配
        open_count = content.count('{')
        close_count = content.count('}')
        # 如果闭合括号不足，在文件末尾添加
        if open_count > close_count:
            diff = open_count - close_count
            # 在最后一个 }); 之前添加缺失的 }
            if content.rstrip().endswith('});'):
                content = content.rstrip()[:-3] + '}' * diff + '});'
            elif content.rstrip().endswith(')'):
                content = content.rstrip()[:-1] + '}' * diff + ')'
        
        if content != original_content:
            file_path.write_text(content, encoding='utf-8')
            print(f"✓ Fixed: {file_path}")
            return True
        else:
            return False
    except Exception as e:
        print(f"✗ Error fixing {file_path}: {e}")
        return False

def main():
    tools_dir = Path('apps/app/src/agents/tools')
    files = list(tools_dir.rglob('*.ts'))
    
    files_with_comment = []
    for file in files:
        try:
            content = file.read_text(encoding='utf-8')
            if '# 直接执行，不再使用 workflow.run' in content:
                files_with_comment.append(file)
        except:
            pass
    
    print(f"Found {len(files_with_comment)} files with the comment")
    print()
    
    fixed = 0
    for file in files_with_comment:
        if fix_file(file):
            fixed += 1
    
    print()
    print(f"Fixed {fixed} files")
    print("Please review the changes and fix any remaining issues manually.")

if __name__ == '__main__':
    main()
