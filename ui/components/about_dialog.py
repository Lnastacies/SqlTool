#!/usr/bin/env python3
"""
关于对话框模块 - 显示应用信息、作者信息和打赏功能
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QApplication, QMessageBox
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QFont, QPixmap
import os


class AboutDialog(QDialog):
    """关于对话框"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("关于 SqlTool")
        self.setFixedSize(480, 580)
        # PyQt6 中 WindowContextHelpButtonHint 已被移除，兼容处理
        if hasattr(Qt, 'WindowContextHelpButtonHint'):
            self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)

        self._setup_ui()

    def _setup_ui(self):
        """初始化界面"""
        self.setStyleSheet("""
            QDialog {
                background-color: #F5F5F5;
                font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
            }
        """)

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        self._create_header(main_layout)
        self._create_info_section(main_layout)
        self._create_copyright_section(main_layout)
        self._create_donation_section(main_layout)
        self._create_bottom_bar(main_layout)

    def _create_header(self, parent_layout):
        """创建头部区域"""
        header = QFrame()
        header.setStyleSheet("""
            QFrame {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #2196F3, stop:1 #1565C0);
                border-bottom: 2px solid #0D47A1;
            }
        """)
        header.setFixedHeight(110)

        header_layout = QVBoxLayout(header)
        header_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        title_label = QLabel("SqlTool")
        title_label.setStyleSheet("color: #FFFFFF; font-size: 26px; font-weight: bold; background: transparent;")
        title_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_layout.addWidget(title_label)

        version_label = QLabel("v1.0 - 数据库管理工具")
        version_label.setStyleSheet("color: #E3F2FD; font-size: 13px; background: transparent;")
        version_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_layout.addWidget(version_label)

        parent_layout.addWidget(header)

    def _create_info_section(self, parent_layout):
        """创建信息区域"""
        info_frame = QFrame()
        info_frame.setStyleSheet("""
            QFrame {
                background-color: #FFFFFF;
                border: none;
                margin: 0px;
            }
        """)

        info_layout = QVBoxLayout(info_frame)
        info_layout.setContentsMargins(30, 20, 30, 15)
        info_layout.setSpacing(10)

        section_title = QLabel("作者信息")
        section_title.setStyleSheet("font-size: 15px; font-weight: bold; color: #1565C0;")
        info_layout.addWidget(section_title)

        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet("background-color: #E0E0E0; max-height: 1px;")
        separator.setFixedHeight(1)
        info_layout.addWidget(separator)

        info_items = [
            ("作\u2003\u2003者", "Locus"),
            ("所属公司", "ADTEC-先进数通"),
            ("联系邮箱", "1656113@163.com"),
        ]

        for label, value in info_items:
            row = QHBoxLayout()
            row.setSpacing(10)

            key_label = QLabel(label)
            key_label.setStyleSheet("font-size: 13px; color: #666666; min-width: 70px;")
            key_label.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            row.addWidget(key_label)

            dot = QLabel(":")
            dot.setStyleSheet("font-size: 13px; color: #999999;")
            row.addWidget(dot)

            val_label = QLabel(value)
            val_label.setStyleSheet("font-size: 13px; color: #333333; font-weight: bold;")
            row.addWidget(val_label)

            row.addStretch()
            info_layout.addLayout(row)

        info_layout.addSpacing(5)

        desc_label = QLabel("本工具基于 PyQt6 开发，提供多数据库连接管理、SQL 查询编辑、"
                           "数据导入导出、结构同步等功能，旨在提升数据库开发与运维效率。")
        desc_label.setWordWrap(True)
        desc_label.setStyleSheet("font-size: 12px; color: #888888; line-height: 1.5;")
        info_layout.addWidget(desc_label)

        parent_layout.addWidget(info_frame)

    def _create_copyright_section(self, parent_layout):
        """创建版权协议区域"""
        copyright_frame = QFrame()
        copyright_frame.setStyleSheet("""
            QFrame {
                background-color: #FFFFFF;
                border: none;
                margin: 0px;
            }
        """)

        copyright_layout = QVBoxLayout(copyright_frame)
        copyright_layout.setContentsMargins(30, 10, 30, 10)
        copyright_layout.setSpacing(4)

        section_title = QLabel("版权协议")
        section_title.setStyleSheet("font-size: 15px; font-weight: bold; color: #1565C0;")
        copyright_layout.addWidget(section_title)

        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet("background-color: #E0E0E0; max-height: 1px;")
        separator.setFixedHeight(1)
        copyright_layout.addWidget(separator)

        rules = [
            ("\u00b7 个人使用：\u5141\u8bb8\u81ea\u7531\u4f7f\u7528\u3001\u590d\u5236\u3001\u4fee\u6539\u672c\u5de5\u5177\u6e90\u7801"),
            ("\u00b7 \u5546\u7528\u6388\u6743：\u5982\u9700\u5c06\u672c\u5de5\u5177\u7528\u4e8e\u5546\u4e1a\u7528\u9014\uff08\u5305\u62ec\u4f46\u4e0d\u9650\u4e8e\u96c6\u6210\u3001\u53d1\u884c\u3001\u6258\u7ba1\u670d\u52a1\u7b49\uff09\uff0c\u5fc5\u987b\u83b7\u5f97\u4f5c\u8005\u4e66\u9762\u6388\u6743"),
            ("\u00b7 \u8054\u7cfb\u65b9\u5f0f：\u90ae\u7bb1 1656113@163.com \u6216\u901a\u8fc7 GitHub Issues \u8054\u7cfb"),
        ]

        for rule in rules:
            label = QLabel(rule)
            label.setWordWrap(True)
            label.setStyleSheet("font-size: 12px; color: #666666; line-height: 1.6;")
            copyright_layout.addWidget(label)

        parent_layout.addWidget(copyright_frame)

    def _create_donation_section(self, parent_layout):
        """创建打赏区域"""
        donation_frame = QFrame()
        donation_frame.setStyleSheet("""
            QFrame {
                background-color: #FFF8E1;
                border: 1px solid #FFE082;
                border-radius: 6px;
                margin: 0px 15px;
            }
        """)

        donation_layout = QVBoxLayout(donation_frame)
        donation_layout.setContentsMargins(20, 15, 20, 15)
        donation_layout.setSpacing(8)

        title_row = QHBoxLayout()
        title_row.setSpacing(6)

        heart_label = QLabel("\u2764")  # 爱心符号
        heart_label.setStyleSheet("font-size: 18px; color: #E53935; background: transparent;")
        title_row.addWidget(heart_label)

        donate_title = QLabel("支持作者")
        donate_title.setStyleSheet("font-size: 15px; font-weight: bold; color: #E65100; background: transparent;")
        title_row.addWidget(donate_title)

        title_row.addStretch()
        donation_layout.addLayout(title_row)

        donate_desc = QLabel("如果这个工具对你有帮助，欢迎打赏支持，这将激励我持续更新和完善更多功能！")
        donate_desc.setWordWrap(True)
        donate_desc.setStyleSheet("font-size: 12px; color: #BF360C; background: transparent;")
        donation_layout.addWidget(donate_desc)

        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        wechat_btn = QPushButton("\u5fae\u4fe1\u6295\u5962")  # 微信投喂
        wechat_btn.setStyleSheet("""
            QPushButton {
                font-size: 14px;
                font-weight: bold;
                padding: 8px 28px;
                border: none;
                border-radius: 4px;
                color: #FFFFFF;
                background-color: #07C160;
            }
            QPushButton:hover {
                background-color: #06AD56;
            }
        """)
        wechat_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        wechat_btn.clicked.connect(self._show_wechat_qr)
        btn_layout.addWidget(wechat_btn)

        btn_layout.addStretch()
        donation_layout.addLayout(btn_layout)

        parent_layout.addWidget(donation_frame)

    def _create_bottom_bar(self, parent_layout):
        """创建底部按钮区域"""
        bottom_frame = QFrame()
        bottom_frame.setStyleSheet("background-color: #FFFFFF; border: none;")

        bottom_layout = QVBoxLayout(bottom_frame)
        bottom_layout.setContentsMargins(15, 10, 15, 12)

        close_btn = QPushButton("\u5173\u95ed")  # 关闭
        close_btn.setStyleSheet("""
            QPushButton {
                font-size: 13px;
                padding: 6px 30px;
                background-color: #E0E0E0;
                border: none;
                border-radius: 4px;
                color: #333333;
            }
            QPushButton:hover {
                background-color: #BDBDBD;
            }
        """)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.clicked.connect(self.accept)

        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        btn_layout.addWidget(close_btn)
        bottom_layout.addLayout(btn_layout)

        parent_layout.addWidget(bottom_frame)

    def _show_wechat_qr(self):
        """显示微信收款二维码"""
        resource_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                                    "resources")
        qr_path = os.path.join(resource_path, "wechat_qr.png")

        if os.path.exists(qr_path):
            dialog = QDialog(self)
            dialog.setWindowTitle("微信收款")
            dialog.setFixedSize(320, 380)
            dialog.setWindowFlags(dialog.windowFlags() & ~Qt.WindowType.WindowContextHelpButtonHint)

            layout = QVBoxLayout(dialog)
            layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

            pixmap = QPixmap(qr_path)
            if not pixmap.isNull():
                pixmap = pixmap.scaled(280, 280, Qt.AspectRatioMode.KeepAspectRatio,
                                      Qt.TransformationMode.SmoothTransformation)
                img_label = QLabel()
                img_label.setPixmap(pixmap)
                img_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
                layout.addWidget(img_label)
            else:
                layout.addWidget(QLabel("无法加载二维码图片"))

            tip = QLabel("请使用微信扫码支付")
            tip.setAlignment(Qt.AlignmentFlag.AlignCenter)
            tip.setStyleSheet("font-size: 13px; color: #333333; margin-top: 10px;")
            layout.addWidget(tip)

            close_btn = QPushButton("关闭")
            close_btn.setStyleSheet("""
                QPushButton {
                    font-size: 13px; padding: 6px 24px;
                    background-color: #E0E0E0; border: none;
                    border-radius: 4px; color: #333333;
                }
                QPushButton:hover { background-color: #BDBDBD; }
            """)
            close_btn.clicked.connect(dialog.accept)
            layout.addWidget(close_btn, alignment=Qt.AlignmentFlag.AlignCenter)

            dialog.exec()
        else:
            reply = QMessageBox.question(
                self,
                "提示",
                "未找到微信收款二维码图片。\n\n请将二维码图片放置在 resources 目录下，\n文件名为 wechat_qr.png。\n\n是否复制作者邮箱以便联系？",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.Yes:
                self._copy_email()

    def _copy_email(self):
        """复制作者邮箱到剪贴板"""
        clipboard = QApplication.clipboard()
        clipboard.setText("1656113@163.com")
        QMessageBox.information(self, "已复制", "作者邮箱 1656113@163.com 已复制到剪贴板，欢迎联系！")
