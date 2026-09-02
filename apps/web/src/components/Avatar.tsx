import { isImageUrl } from '../utils/image'
import styles from './Avatar.module.css'

// Avatar 头像渲染：图片地址（本地 /uploads/ 或 OSS/CDN URL）渲染 <img>，
// 否则按原设计展示首字符占位。外层容器的尺寸与圆形样式由调用方 className 提供。
export function Avatar({ value, fallback }: { value?: string | null; fallback?: string }) {
  if (isImageUrl(value)) {
    return <img className={styles.img} src={value} alt="" />
  }
  return <>{value || fallback || ''}</>
}
