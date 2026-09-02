// formatAIAnswer 大模型回答常带 Markdown 记号（**加粗**、# 标题、- 列表、`代码` 等），
// 问答页按纯文本展示：去掉记号、列表规整为圆点，保留换行与段落结构。
export function formatAIAnswer(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '') // 标题记号
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 加粗
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '$1') // 斜体
    .replace(/`{3}[\s\S]*?`{3}/g, (block) => block.replace(/`/g, '')) // 代码块去记号留内容
    .replace(/`([^`]*)`/g, '$1') // 行内代码
    .replace(/^\s*[-*+]\s+/gm, '· ') // 无序列表
    .replace(/^\s{0,3}(\d+)[.、]\s+/gm, '$1. ') // 有序列表规整
    .replace(/^\s*>\s?/gm, '') // 引用记号
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接只留文字
    .replace(/\n{3,}/g, '\n\n') // 收敛多余空行
    .trim()
}
