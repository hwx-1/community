// 判断字符串是否为可渲染的图片地址：
// 开发模式为本地 /uploads/ 路径，生产模式为 OSS / CDN 完整 URL。
export const isImageUrl = (u?: string | null): u is string =>
  !!u && (u.startsWith('/uploads/') || u.startsWith('https://') || u.startsWith('http://'))
