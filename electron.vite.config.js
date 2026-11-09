import { resolve } from 'path'
import fs from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

// 主进程除入口外都以「原样复制」进 out/main（不打包），供 index.js 用相对路径 require。
// 采用目录扫描而非硬编码清单：新增模块不会再因漏登记而在运行时 "Cannot find module"。
const MAIN_ENTRY_MODULES = new Set(['index.js', 'preload.js']) // 入口由 rollup 产出，不能覆盖
const SHARED_MODULES = ['plugin-loader.js'] // src/shared → out/main

function copyMainModules() {
  return {
    name: 'copy-main-modules',
    closeBundle() {
      const mainDir = resolve(__dirname, 'src/main')
      const outDir = resolve(__dirname, 'out')
      const copies = fs
        .readdirSync(mainDir)
        .filter((name) => name.endsWith('.js') && !MAIN_ENTRY_MODULES.has(name))
        .map((name) => [resolve(mainDir, name), resolve(outDir, 'main', name)])
      for (const name of SHARED_MODULES) {
        copies.push([resolve(__dirname, 'src/shared', name), resolve(outDir, 'main', name)])
      }
      for (const [srcPath, destPath] of copies) {
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, destPath)
        }
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMainModules()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'src/main/preload.js')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer')
      }
    }
  }
})
