#!/usr/bin/env python3
"""
SSH隧道管理器
"""

import socket
import threading
import time
from datetime import datetime
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit, 
    QPushButton, QLabel, QCheckBox, QComboBox, QMessageBox,
    QGroupBox, QSpinBox, QTextEdit, QProgressBar
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QObject


class SSHConnection:
    """SSH连接封装"""
    
    def __init__(self, host, port, username, password=None, key_file=None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.key_file = key_file
        self.sock = None
        self._connected = False
    
    def connect(self):
        """建立SSH连接"""
        try:
            import paramiko
            
            self.ssh = paramiko.SSHClient()
            self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_kwargs = {
                'hostname': self.host,
                'port': self.port,
                'username': self.username,
            }
            
            if self.key_file:
                connect_kwargs['key_filename'] = self.key_file
            elif self.password:
                connect_kwargs['password'] = self.password
            
            self.ssh.connect(**connect_kwargs)
            self._connected = True
            return True, "连接成功"
            
        except ImportError:
            return False, "需要安装paramiko库: pip install paramiko"
        except Exception as e:
            return False, f"连接失败: {str(e)}"
    
    def disconnect(self):
        """断开连接"""
        if hasattr(self, 'ssh') and self.ssh:
            try:
                self.ssh.close()
            except Exception:
                pass
        self._connected = False
    
    def is_connected(self):
        """检查连接状态"""
        return self._connected
    
    def create_local_forward(self, local_port, remote_host, remote_port):
        """创建本地端口转发
        
        Args:
            local_port: 本地监听端口
            remote_host: 远程目标主机
            remote_port: 远程目标端口
            
        Returns:
            成功返回True
        """
        try:
            transport = self.ssh.get_transport()
            if not transport:
                return False
            
            transport.request_port_forward('', local_port, handler=self._create_handler(remote_host, remote_port))
            self.local_port = local_port
            return True
            
        except Exception as e:
            return False
    
    def _create_handler(self, remote_host, remote_port):
        """创建端口转发处理器"""
        def handler(chan, host, port):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.connect((remote_host, remote_port))
            except Exception as e:
                return
            
            def forward():
                try:
                    while True:
                        data = sock.recv(1024)
                        if not data:
                            break
                        chan.send(data)
                except Exception:
                    pass
                finally:
                    sock.close()
            
            def backward():
                try:
                    while True:
                        data = chan.recv(1024)
                        if not data:
                            break
                        sock.send(data)
                except Exception:
                    pass
                finally:
                    sock.close()
            
            thread = threading.Thread(target=forward)
            thread.daemon = True
            thread.start()
            
            backward()
        
        return handler


class SSHTunnelManager(QObject):
    """SSH隧道管理器"""
    
    status_changed = pyqtSignal(bool, str)
    
    def __init__(self):
        super().__init__()
        self.tunnels = {}
        self.logger = None
    
    def set_logger(self, logger):
        """设置日志记录器"""
        self.logger = logger
    
    def create_tunnel(self, name, ssh_host, ssh_port, ssh_username, ssh_password=None,
                     ssh_key_file=None, local_port=0, remote_host='127.0.0.1', 
                     remote_port=3306, database_type='MySQL'):
        """创建SSH隧道
        
        Args:
            name: 隧道名称
            ssh_host: SSH服务器地址
            ssh_port: SSH端口
            ssh_username: SSH用户名
            ssh_password: SSH密码
            ssh_key_file: SSH密钥文件路径
            local_port: 本地转发端口（0表示自动分配）
            remote_host: 远程数据库主机
            remote_port: 远程数据库端口
            database_type: 数据库类型
            
        Returns:
            (success, message, local_port)
        """
        try:
            ssh_conn = SSHConnection(ssh_host, ssh_port, ssh_username, 
                                    ssh_password, ssh_key_file)
            
            success, msg = ssh_conn.connect()
            if not success:
                return False, msg, None
            
            if local_port == 0:
                local_port = self._find_available_port()
            
            if ssh_conn.create_local_forward(local_port, remote_host, remote_port):
                self.tunnels[name] = {
                    'ssh_conn': ssh_conn,
                    'local_port': local_port,
                    'remote_host': remote_host,
                    'remote_port': remote_port,
                    'created_at': datetime.now()
                }
                
                if self.logger:
                    self.logger.log('INFO', f"SSH隧道 '{name}' 创建成功，本地端口: {local_port}")
                
                self.status_changed.emit(True, f"隧道 '{name}' 已启动")
                return True, "隧道创建成功", local_port
            else:
                ssh_conn.disconnect()
                return False, "端口转发创建失败", None
                
        except Exception as e:
            return False, str(e), None
    
    def close_tunnel(self, name):
        """关闭隧道"""
        if name in self.tunnels:
            tunnel = self.tunnels[name]
            if 'ssh_conn' in tunnel:
                tunnel['ssh_conn'].disconnect()
            del self.tunnels[name]
            
            if self.logger:
                self.logger.log('INFO', f"SSH隧道 '{name}' 已关闭")
            
            self.status_changed.emit(False, f"隧道 '{name}' 已关闭")
            return True
        return False
    
    def close_all(self):
        """关闭所有隧道"""
        for name in list(self.tunnels.keys()):
            self.close_tunnel(name)
    
    def get_tunnel(self, name):
        """获取隧道信息"""
        return self.tunnels.get(name)
    
    def get_all_tunnels(self):
        """获取所有隧道"""
        return self.tunnels.copy()
    
    def is_tunnel_active(self, name):
        """检查隧道是否活跃"""
        if name in self.tunnels:
            tunnel = self.tunnels[name]
            return tunnel['ssh_conn'].is_connected()
        return False
    
    def _find_available_port(self):
        """查找可用端口"""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            return s.getsockname()[1]


class SSHTunnelDialog(QDialog):
    """SSH隧道配置对话框"""
    
    def __init__(self, parent=None, tunnel_config=None):
        super().__init__(parent)
        self.parent = parent
        self.tunnel_config = tunnel_config or {}
        self.tunnel_manager = SSHTunnelManager()
        
        self.setWindowTitle("SSH隧道配置")
        self.setGeometry(200, 150, 500, 550)
        self.setMinimumSize(450, 480)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QGroupBox {
                font-weight: 600;
                border: 1px solid #d0d0d0;
                border-radius: 4px;
                margin-top: 10px;
                padding-top: 10px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
            QLineEdit, QSpinBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px 10px;
                background-color: #ffffff;
            }
            QLineEdit:focus, QSpinBox:focus {
                border: 1px solid #1a73e8;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 8px 20px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton#primary {
                background-color: #1a73e8;
                color: white;
                border: none;
            }
            QPushButton#primary:hover {
                background-color: #1557b0;
            }
            QLabel {
                font-size: 12px;
                color: #333333;
            }
            QCheckBox {
                font-size: 12px;
            }
        """)
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(12)
        layout.setContentsMargins(20, 20, 20, 20)
        
        # SSH服务器配置
        ssh_group = QGroupBox("SSH服务器")
        ssh_layout = QFormLayout()
        
        self.host_input = QLineEdit()
        self.host_input.setPlaceholderText("例如: ssh.example.com")
        self.host_input.setText(self.tunnel_config.get('ssh_host', ''))
        ssh_layout.addRow("主机地址:", self.host_input)
        
        self.port_input = QSpinBox()
        self.port_input.setRange(1, 65535)
        self.port_input.setValue(self.tunnel_config.get('ssh_port', 22))
        ssh_layout.addRow("端口:", self.port_input)
        
        self.username_input = QLineEdit()
        self.username_input.setPlaceholderText("SSH用户名")
        self.username_input.setText(self.tunnel_config.get('ssh_username', ''))
        ssh_layout.addRow("用户名:", self.username_input)
        
        self.auth_type = QComboBox()
        self.auth_type.addItems(["密码认证", "密钥文件认证"])
        self.auth_type.currentIndexChanged.connect(self.on_auth_type_changed)
        ssh_layout.addRow("认证方式:", self.auth_type)
        
        self.password_input = QLineEdit()
        self.password_input.setPlaceholderText("SSH密码")
        self.password_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.password_input.setText(self.tunnel_config.get('ssh_password', ''))
        ssh_layout.addRow("密码:", self.password_input)
        
        self.key_file_input = QLineEdit()
        self.key_file_input.setPlaceholderText("私钥文件路径")
        ssh_layout.addRow("密钥文件:", self.key_file_input)
        
        ssh_group.setLayout(ssh_layout)
        layout.addWidget(ssh_group)
        
        # 端口转发配置
        forward_group = QGroupBox("端口转发")
        forward_layout = QFormLayout()
        
        self.local_port_input = QSpinBox()
        self.local_port_input.setRange(0, 65535)
        self.local_port_input.setValue(self.tunnel_config.get('local_port', 0))
        forward_layout.addRow("本地端口 (0=自动):", self.local_port_input)
        
        self.remote_host_input = QLineEdit()
        self.remote_host_input.setPlaceholderText("数据库服务器地址")
        self.remote_host_input.setText(self.tunnel_config.get('remote_host', '127.0.0.1'))
        forward_layout.addRow("远程主机:", self.remote_host_input)
        
        self.remote_port_input = QSpinBox()
        self.remote_port_input.setRange(1, 65535)
        self.remote_port_input.setValue(self.tunnel_config.get('remote_port', 3306))
        forward_layout.addRow("远程端口:", self.remote_port_input)
        
        forward_group.setLayout(forward_layout)
        layout.addWidget(forward_group)
        
        # 测试按钮
        test_layout = QHBoxLayout()
        test_btn = QPushButton("测试连接")
        test_btn.clicked.connect(self.test_connection)
        test_layout.addWidget(test_btn)
        test_layout.addStretch()
        layout.addLayout(test_layout)
        
        # 状态显示
        self.status_label = QLabel("")
        self.status_label.setStyleSheet("padding: 8px; background-color: #f0f0f0; border-radius: 4px;")
        layout.addWidget(self.status_label)
        
        # 按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        save_btn = QPushButton("保存")
        save_btn.setObjectName("primary")
        save_btn.clicked.connect(self.save_tunnel)
        btn_layout.addWidget(save_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)
        
        layout.addLayout(btn_layout)
        
        self.on_auth_type_changed(0)
    
    def on_auth_type_changed(self, index):
        """认证方式变化"""
        if index == 0:
            self.password_input.setEnabled(True)
            self.key_file_input.setEnabled(False)
        else:
            self.password_input.setEnabled(False)
            self.key_file_input.setEnabled(True)
    
    def test_connection(self):
        """测试SSH连接"""
        host = self.host_input.text().strip()
        port = self.port_input.value()
        username = self.username_input.text().strip()
        
        if not host or not username:
            QMessageBox.warning(self, "提示", "请填写SSH主机和用户名")
            return
        
        self.status_label.setText("正在测试连接...")
        
        try:
            import paramiko
            
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_kwargs = {
                'hostname': host,
                'port': port,
                'username': username,
                'timeout': 10
            }
            
            if self.auth_type.currentIndex() == 0:
                password = self.password_input.text()
                if not password:
                    QMessageBox.warning(self, "提示", "请输入密码")
                    self.status_label.setText("")
                    return
                connect_kwargs['password'] = password
            else:
                key_file = self.key_file_input.text().strip()
                if not key_file:
                    QMessageBox.warning(self, "提示", "请输入密钥文件路径")
                    self.status_label.setText("")
                    return
                connect_kwargs['key_filename'] = key_file
            
            ssh.connect(**connect_kwargs)
            ssh.close()
            
            self.status_label.setText("✓ SSH连接测试成功!")
            self.status_label.setStyleSheet("padding: 8px; background-color: #d4edda; border-radius: 4px; color: #155724;")
            
        except ImportError:
            QMessageBox.warning(self, "缺少依赖", "请安装paramiko库:\npip install paramiko")
        except Exception as e:
            self.status_label.setText(f"✗ 连接失败: {str(e)}")
            self.status_label.setStyleSheet("padding: 8px; background-color: #f8d7da; border-radius: 4px; color: #721c24;")
    
    def save_tunnel(self):
        """保存隧道配置"""
        host = self.host_input.text().strip()
        username = self.username_input.text().strip()
        
        if not host:
            QMessageBox.warning(self, "提示", "请输入SSH主机地址")
            return
        
        if not username:
            QMessageBox.warning(self, "提示", "请输入SSH用户名")
            return
        
        self.tunnel_config = {
            'ssh_host': host,
            'ssh_port': self.port_input.value(),
            'ssh_username': username,
            'ssh_password': self.password_input.text() if self.auth_type.currentIndex() == 0 else None,
            'ssh_key_file': self.key_file_input.text().strip() if self.auth_type.currentIndex() == 1 else None,
            'local_port': self.local_port_input.value(),
            'remote_host': self.remote_host_input.text().strip(),
            'remote_port': self.remote_port_input.value()
        }
        
        self.accept()


class SSHTunnelStatusWidget:
    """SSH隧道状态显示组件（用于集成到主界面）"""
    
    def __init__(self, main_window):
        self.main_window = main_window
        self.tunnel_manager = SSHTunnelManager()
        self.tunnel_manager.set_logger(main_window.logger)
    
    def create_tunnel_for_connection(self, conn_name, config):
        """为连接创建SSH隧道
        
        Args:
            conn_name: 连接名称
            config: SSH配置字典
            
        Returns:
            (success, message, new_connection_params)
        """
        if not config or not config.get('enabled'):
            return True, "SSH隧道未启用", None
        
        success, msg, local_port = self.tunnel_manager.create_tunnel(
            name=conn_name,
            ssh_host=config['host'],
            ssh_port=config.get('port', 22),
            ssh_username=config['username'],
            ssh_password=config.get('password'),
            ssh_key_file=config.get('key_file'),
            local_port=config.get('local_port', 0),
            remote_host=config.get('remote_host', '127.0.0.1'),
            remote_port=config.get('remote_port', 3306)
        )
        
        if success:
            return True, f"隧道已建立 (本地端口: {local_port})", {
                'host': '127.0.0.1',
                'port': local_port
            }
        else:
            return False, msg, None
    
    def close_tunnel_for_connection(self, conn_name):
        """关闭连接的SSH隧道"""
        self.tunnel_manager.close_tunnel(conn_name)
    
    def get_active_tunnels(self):
        """获取活跃的隧道列表"""
        return list(self.tunnel_manager.get_all_tunnels().keys())
