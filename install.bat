@echo off

rem SQL Tool 安装脚本

:: 检查是否以管理员权限运行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 请以管理员权限运行此脚本！
    pause
    exit /b 1
)

echo 正在安装 SQL Tool...

:: 创建安装目录
set "INSTALL_DIR=%ProgramFiles%\SQL Tool"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR"

:: 复制可执行文件
if exist "dist\SqlTool.exe" (
    copy "dist\SqlTool.exe" "%INSTALL_DIR%\" > nul
    if %errorLevel% equ 0 (
        echo 可执行文件复制成功
    ) else (
        echo 可执行文件复制失败
        pause
        exit /b 1
    )
) else (
    echo 找不到可执行文件 dist\SqlTool.exe
    pause
    exit /b 1
)

:: 复制配置文件
if exist "connections.json" copy "connections.json" "%INSTALL_DIR%\" > nul
if exist "operation_log.txt" copy "operation_log.txt" "%INSTALL_DIR%\" > nul

echo 安装完成！
echo SQL Tool 已安装到 "%INSTALL_DIR%"
echo 请手动创建桌面快捷方式。
pause
