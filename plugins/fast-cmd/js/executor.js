    // ========== Script Executor ==========
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    /**
     * 执行脚本文件
     * .bat / .cmd → cmd.exe /c
     * .ps1 → powershell.exe -ExecutionPolicy Bypass -File
     * 只负责启动，不捕获输出
     */
    const executeScript = (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      let cmd, args;

      if (ext === '.ps1') {
        cmd = 'powershell.exe';
        args = ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', filePath];
      } else {
        // .bat / .cmd
        cmd = 'cmd.exe';
        args = ['/c', filePath];
      }

      try {
        const child = spawn(cmd, args, {
          cwd: path.dirname(filePath),
          detached: true,
          stdio: 'ignore',
          shell: false,
          windowsHide: false,
        });
        child.unref();
        return true;
      } catch (err) {
        console.error('[FastCmd] executeScript error:', err);
        return false;
      }
    };

    /**
     * 在系统默认编辑器中打开脚本
     */
    const openInSystemEditor = (filePath) => {
      try {
        const { shell } = require('electron');
        shell.openPath(filePath);
        return true;
      } catch (err) {
        console.error('[FastCmd] openInSystemEditor error:', err);
        return false;
      }
    };

    /**
     * 获取脚本文件信息
     */
    const getScriptInfo = (filePath) => {
      try {
        const stat = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        return {
          size: stat.size,
          modified: stat.mtime,
          type: ext === '.ps1' ? 'PowerShell' : 'Batch',
          encoding: ext === '.ps1' ? 'UTF-8' : 'GBK/UTF-8',
        };
      } catch (err) {
        return null;
      }
    };
