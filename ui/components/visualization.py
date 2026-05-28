#!/usr/bin/env python3
"""
数据可视化组件
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QWidget, QPushButton,
    QLabel, QComboBox, QTableWidget, QChartView, QGraphicsView
)
from PyQt6.QtCore import Qt, QRectF
from PyQt6.QtGui import QColor, QPainter, QPen, QBrush, QFont, QPixmap
from PyQt6.QtCharts import QChart, QChartView, QBarSeries, QBarSet, QPieSeries, QLineSeries, QValueAxis, QBarCategoryAxis
from PyQt6.QtWidgets import QApplication
import math


class ChartGenerator(QDialog):
    """图表生成器"""
    
    def __init__(self, main_window, data=None):
        super().__init__(main_window)
        self.main_window = main_window
        self.data = data or []
        self.chart_type = 'bar'
        
        self.setWindowTitle("数据可视化")
        self.setGeometry(150, 100, 900, 650)
        self.setMinimumSize(800, 500)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QComboBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 6px 12px;
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
            QChartView {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
        """)
        
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setSpacing(10)
        layout.setContentsMargins(12, 12, 12, 12)
        
        # 顶部配置栏
        config_layout = QHBoxLayout()
        
        config_layout.addWidget(QLabel("图表类型:"))
        self.chart_type_combo = QComboBox()
        self.chart_type_combo.addItems([
            "柱状图", "饼图", "折线图", "条形图", "面积图"
        ])
        self.chart_type_combo.currentIndexChanged.connect(self.on_chart_type_changed)
        config_layout.addWidget(self.chart_type_combo)
        
        config_layout.addWidget(QLabel("数据来源:"))
        self.data_source_combo = QComboBox()
        self.data_source_combo.addItems(["当前结果集", "指定表"])
        config_layout.addWidget(self.data_source_combo, 1)
        
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.generate_chart)
        config_layout.addWidget(refresh_btn)
        
        export_btn = QPushButton("导出图片")
        export_btn.clicked.connect(self.export_chart)
        config_layout.addWidget(export_btn)
        
        layout.addLayout(config_layout)
        
        # 图表视图
        self.chart_view = QChartView()
        self.chart_view.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.chart_view.setDragMode(QGraphicsView.DragMode.ScrollHandDrag)
        layout.addWidget(self.chart_view, 1)
        
        # 底部按钮
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()
        
        close_btn = QPushButton("关闭")
        close_btn.clicked.connect(self.accept)
        btn_layout.addWidget(close_btn)
        
        layout.addLayout(btn_layout)
    
    def on_chart_type_changed(self, index):
        """图表类型变化"""
        chart_types = ['bar', 'pie', 'line', 'horizontalBar', 'area']
        self.chart_type = chart_types[index] if index < len(chart_types) else 'bar'
        self.generate_chart()
    
    def generate_chart(self):
        """生成图表"""
        # 创建示例数据
        if not self.data:
            self.data = [
                {"category": "一月", "value": 120},
                {"category": "二月", "value": 200},
                {"category": "三月", "value": 150},
                {"category": "四月", "value": 300},
                {"category": "五月", "value": 250},
                {"category": "六月", "value": 400},
            ]
        
        # 创建图表
        chart = QChart()
        chart.setTitle("数据统计")
        chart.setAnimationOptions(QChart.AnimationOption.SeriesAnimations)
        
        if self.chart_type == 'bar':
            series = QBarSeries()
            bar_set = QBarSet("数值")
            
            categories = []
            for i, item in enumerate(self.data):
                bar_set.append(item.get('value', 0))
                categories.append(item.get('category', f'项{i+1}'))
            
            series.append(bar_set)
            chart.addSeries(series)
            
            axis = QBarCategoryAxis()
            axis.append(categories)
            chart.createDefaultAxes()
            chart.setAxisX(axis, series)
            
        elif self.chart_type == 'pie':
            series = QPieSeries()
            for item in self.data:
                series.append(item.get('category', ''), item.get('value', 0))
            
            series.setLabelsVisible(True)
            chart.addSeries(series)
            
        elif self.chart_type == 'line':
            series = QLineSeries()
            series.setName("数值")
            
            for i, item in enumerate(self.data):
                series.append(i, item.get('value', 0))
            
            chart.addSeries(series)
            chart.createDefaultAxes()
        
        self.chart_view.setChart(chart)
    
    def export_chart(self):
        """导出图表为图片"""
        from PyQt6.QtWidgets import QFileDialog
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出图表", "",
            "PNG图片 (*.png);;JPEG图片 (*.jpg)"
        )
        
        if file_path:
            pixmap = self.chart_view.grab()
            pixmap.save(file_path)
            
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.information(self, "导出成功", f"图表已保存到:\n{file_path}")


class DashboardWidget(QWidget):
    """仪表盘组件"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.setup_ui()
    
    def setup_ui(self):
        """设置UI"""
        self.setStyleSheet("""
            QWidget {
                background-color: #ffffff;
            }
            QLabel {
                font-family: 'Segoe UI', Arial;
            }
        """)
        
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        layout.setContentsMargins(16, 16, 16, 16)
        
        # 标题
        title = QLabel("📊 数据库仪表盘")
        title.setStyleSheet("font-size: 20px; font-weight: bold; color: #333; padding: 8px;")
        layout.addWidget(title)
        
        # 统计卡片区域
        cards_layout = QHBoxLayout()
        cards_layout.setSpacing(16)
        
        # 连接数卡片
        self.conn_card = self.create_stat_card("连接数", "0", "#2196F3")
        cards_layout.addWidget(self.conn_card)
        
        # 表数量卡片
        self.table_card = self.create_stat_card("数据表", "0", "#4CAF50")
        cards_layout.addWidget(self.table_card)
        
        # 视图数量卡片
        self.view_card = self.create_stat_card("视图", "0", "#FF9800")
        cards_layout.addWidget(self.view_card)
        
        # 总记录数卡片
        self.record_card = self.create_stat_card("总记录数", "0", "#9C27B0")
        cards_layout.addWidget(self.record_card)
        
        layout.addLayout(cards_layout)
        
        # 图表区域
        chart_layout = QHBoxLayout()
        chart_layout.setSpacing(16)
        
        # 小图表1
        chart1 = self.create_mini_chart("表大小分布")
        chart_layout.addWidget(chart1, 1)
        
        # 小图表2
        chart2 = self.create_mini_chart("查询趋势")
        chart_layout.addWidget(chart2, 1)
        
        layout.addLayout(chart_layout, 1)
    
    def create_stat_card(self, title, value, color):
        """创建统计卡片"""
        card = QWidget()
        card.setStyleSheet(f"""
            QWidget {{
                background-color: {color};
                border-radius: 8px;
                padding: 16px;
                min-width: 150px;
            }}
        """)
        
        layout = QVBoxLayout(card)
        layout.setSpacing(8)
        
        title_label = QLabel(title)
        title_label.setStyleSheet("color: white; font-size: 12px; opacity: 0.9;")
        layout.addWidget(title_label)
        
        value_label = QLabel(value)
        value_label.setStyleSheet("color: white; font-size: 28px; font-weight: bold;")
        layout.addWidget(value_label)
        
        return card
    
    def create_mini_chart(self, title):
        """创建小图表"""
        widget = QWidget()
        widget.setStyleSheet("""
            QWidget {
                background-color: #f8f9fa;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 12px;
            }
        """)
        
        layout = QVBoxLayout(widget)
        layout.setSpacing(8)
        
        title_label = QLabel(title)
        title_label.setStyleSheet("font-size: 14px; font-weight: bold; color: #333;")
        layout.addWidget(title_label)
        
        # 图表区域（占位）
        chart_area = QLabel("图表预览区域")
        chart_area.setStyleSheet("""
            background-color: white;
            border: 1px dashed #ccc;
            border-radius: 4px;
            padding: 40px;
            color: #999;
        """)
        chart_area.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(chart_area, 1)
        
        return widget
    
    def refresh_stats(self):
        """刷新统计数据"""
        # 更新连接数
        if hasattr(self.main_window, 'connection_pool'):
            conn_count = len(self.main_window.connection_pool.active_connections)
            self.conn_card.findChildren(QLabel)[1].setText(str(conn_count))
