#!/bin/bash
# 批量移除工具中的 context.workflow.run 调用

# 查找所有包含 context.workflow.run 的工具文件
files=$(find apps/app/src/agents/tools -name "*.ts" -type f -exec grep -l "context\.workflow\.run" {} \;)

for file in $files; do
  echo "Processing: $file"
  
  # 使用 sed 移除 workflow.run 包装
  # 模式1: return await context.workflow.run(...) -> 直接返回内容
  sed -i '' 's/return await context\.workflow\.run(`[^`]*`, async () => {/\/\/ 直接执行，不再使用 workflow.run/g' "$file"
  sed -i '' 's/return await context\.workflow\.run(`[^`]*`, async () => {/\/\/ 直接执行，不再使用 workflow.run/g' "$file"
  
  # 移除闭合的 }); 但保留函数体
  # 这个需要更精确的处理，暂时手动处理
done

echo "Done. Please review the changes and fix any remaining issues manually."
