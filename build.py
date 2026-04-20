#!/usr/bin/env python3
"""
PyInstaller打包脚本
"""

import os
import sys
import shutil

# 清理之前的构建目录
if os.path.exists('dist'):
    shutil.rmtree('dist')
if os.path.exists('build'):
    shutil.rmtree('build')

# 构建命令
build_command = [
    'pyinstaller',
    '--name', 'TRAE-SQL-Manager',
    '--onefile',
    '--windowed',
    '--add-data=resources;resources',
    '--hidden-import=mysql.connector',
    '--hidden-import=psycopg2',
    '--hidden-import=pyodbc',
    '--hidden-import=mariadb',
    '--hidden-import=pandas',
    '--hidden-import=openpyxl',
    '--hidden-import=cryptography',
    '--hidden-import=paramiko',
    '--hidden-import=pygraphviz',
    '--hidden-import=matplotlib',
    '--hidden-import=networkx',
    'SqlTool.py'
]

# 执行构建命令
print('开始构建...')
import subprocess
result = subprocess.run(build_command, capture_output=True, text=True)

if result.returncode == 0:
    print('构建成功！')
    print('可执行文件已生成在 dist 目录中')
else:
    print('构建失败:')
    print(result.stderr)
