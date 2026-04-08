@echo off

rem SQL Tool 卸载脚本

:: 检查是否以管理员权限运行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo 请以管理员权限运行此脚本！
    pause
    exit /b 1
)

echo 正在卸载 SQL Tool...

:: 删除桌面快捷方式
if exist "%USERPROFILE%\Desktop\SQL Tool.lnk" del "%USERPROFILE%\Desktop\SQL Tool.lnk"

:: 删除安装目录
set "INSTALL_DIR=%ProgramFiles%\SQL Tool"
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%"
    if %errorLevel% equ 0 (
        echo 安装目录删除成功
    ) else (
        echo 安装目录删除失败
        pause
        exit /b 1
    )
) else (
    echo 安装目录不存在
)

echo 卸载完成！
echo SQL Tool 已成功卸载。
pause
