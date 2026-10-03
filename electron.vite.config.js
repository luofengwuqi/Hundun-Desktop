import { resolve } from 'path'
import fs from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

function copyMainModules() {
  return {
    name: 'copy-main-modules',
    closeBundle() {
      const copies = [
        ['src/main/plugin-manager.js', 'out/main/plugin-manager.js'],
        ['src/main/database.js', 'out/main/database.js'],
        ['src/main/plugin-preload.js', 'out/main/plugin-preload.js'],
        ['src/main/plugin-installer.js', 'out/main/plugin-installer.js'],
        ['src/main/paths.js', 'out/main/paths.js'],
        ['src/main/sound-settings.js', 'out/main/sound-settings.js'],
        ['src/shared/plugin-loader.js', 'out/main/plugin-loader.js']
      ]
      for (const [src, dest] of copies) {
        const srcPath = resolve(__dirname, src)
        const destPath = resolve(__dirname, dest)
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
