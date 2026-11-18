; ========== HundunDesktop NSIS 自定义脚本 ==========
; 决策63: Windows 数据不再放安装目录 (改为 %APPDATA%\<包名>), 但已发布的旧版
; 仍把数据写在 <安装目录>\user-data, 而 NSIS 卸载器会 `RMDir /r $INSTDIR`,
; 覆盖安装 (升级) 时这个旧卸载器会先跑 —— 数据在装新文件之前就没了。
;
; customInit 在 .onInit 里、install Section 之前执行 (先于 uninstallOldVersion),
; 所以这里有机会在旧卸载器动手前把 user-data 复制到系统 userData 目录。
; 只复制不删除: 旧目录留着, 由用户自行清理 (数据安全优先)。
!macro customInit
  ${If} ${FileExists} "$INSTDIR\user-data\*.*"
    DetailPrint "Backing up legacy user-data: $INSTDIR\user-data -> $APPDATA\${APP_PACKAGE_NAME}"
    ; xcopy 递归复制 (/E 含空目录, /I 目标按目录处理, /Y 覆盖, /Q 静默)
    nsExec::ExecToLog '"$SYSDIR\xcopy.exe" /E /I /Y /Q "$INSTDIR\user-data" "$APPDATA\${APP_PACKAGE_NAME}"'
    Pop $0
    ; 失败也继续安装: 复制失败不该让安装中断 (仅日志留痕)
    ${If} $0 != 0
      DetailPrint "WARNING: legacy user-data backup exited with code $0"
    ${EndIf}
  ${EndIf}
!macroend
