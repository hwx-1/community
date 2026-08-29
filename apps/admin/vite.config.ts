import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 生产构建挂载在同源 /admin/ 路径下；开发服务器保持根路径
  base: command === 'build' ? '/admin/' : '/',
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
}))
