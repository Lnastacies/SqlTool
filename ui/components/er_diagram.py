#!/usr/bin/env python3
"""
ER图生成器
"""

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QWidget, QPushButton,
    QLabel, QComboBox, QCheckBox, QSlider, QSpinBox, QGraphicsView,
    QGraphicsScene, QGraphicsItem, QGraphicsTextItem, QGraphicsRectItem,
    QGraphicsLineItem, QGraphicsSimpleTextItem, QMessageBox, QFileDialog,
    QToolBar, QSpinBox, QColorDialog, QFontDialog, QInputDialog
)
from PyQt6.QtCore import Qt, QRectF, QPointF, pyqtSignal, QRect
from PyQt6.QtGui import (
    QPen, QBrush, QColor, QPainter, QFont, QPixmap, QImage,
    QPainterPath, QPolygonF
)


class ERTableItem(QGraphicsRectItem):
    """ER图中的表项"""
    
    def __init__(self, table_name, columns, x, y, parent=None):
        super().__init__(parent)
        self.table_name = table_name
        self.columns = columns
        self.setRect(QRectF(x, y, 200, 30 + len(columns) * 22))
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsSelectable)
        
        # 颜色
        self.setBrush(QBrush(QColor("#E3F2FD")))
        self.setPen(QPen(QColor("#1A73E8"), 2))
        
        # 列位置
        self.column_positions = {}
        for i, col in enumerate(columns):
            self.column_positions[col['name']] = y + 35 + i * 22
    
    def paint(self, painter, option, widget=None):
        """绘制表项"""
        super().paint(painter, option, widget)
        
        # 绘制表名
        font = QFont("Segoe UI", 10, QFont.Weight.Bold)
        painter.setFont(font)
        painter.setPen(QColor("#1A73E8"))
        painter.drawText(self.rect().topLeft() + QPointF(10, 22), self.table_name)
        
        # 绘制列
        font = QFont("Segoe UI", 9)
        painter.setFont(font)
        painter.setPen(QColor("#333333"))
        
        for i, col in enumerate(self.columns):
            y = self.rect().top() + 35 + i * 22
            name = col['name']
            col_type = col.get('type', '')[:20]
            
            # 列名
            painter.drawText(QPointF(self.rect().left() + 10, y + 14), name)
            
            # 类型
            painter.drawText(QPointF(self.rect().left() + 120, y + 14), col_type)
            
            # 主键/外键标识
            if col.get('primary_key'):
                painter.setPen(QColor("#FF9800"))
                painter.drawText(QPointF(self.rect().left() + 195, y + 14), "🔑")
                painter.setPen(QColor("#333333"))
            elif col.get('foreign_key'):
                painter.setPen(QColor("#4CAF50"))
                painter.drawText(QPointF(self.rect().left() + 195, y + 14), "🔗")
                painter.setPen(QColor("#333333"))


class ERRelationLine(QGraphicsLineItem):
    """ER图中的关系线"""
    
    def __init__(self, start_item, start_col, end_item, end_col, relation_type="1:N", parent=None):
        super().__init__(parent)
        self.start_item = start_item
        self.end_item = end_item
        self.relation_type = relation_type
        
        # 设置线条样式
        pen = QPen(QColor("#666666"), 1.5)
        if relation_type == "1:1":
            pen.setStyle(Qt.PenStyle.DashLine)
        self.setPen(pen)
        
        self.update_line()
    
    def update_line(self):
        """更新线条位置"""
        if self.start_item and self.end_item:
            start = self.start_item.scenePos() + QPointF(200, 60)
            end = self.end_item.scenePos() + QPointF(0, 60)
            self.setLine(start.x(), start.y(), end.x(), end.y())
    
    def paint(self, painter, option, widget=None):
        """绘制关系线"""
        super().paint(painter, option, widget)
        
        # 绘制关系符号
        line = self.line()
        
        if self.relation_type == "1:N":
            # 一端画1，另一端画N
            painter.drawText(line.p1() + QPointF(-15, -5), "1")
            painter.drawText(line.p2() + QPointF(5, -5), "N")
        elif self.relation_type == "1:1":
            painter.drawText(line.p1() + QPointF(-15, -5), "1")
            painter.drawText(line.p2() + QPointF(5, -5), "1")


class ERDiagramGenerator(QDialog):
    """ER图生成器"""
    
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.tables = []
        self.relations = []
        self.table_items = {}
        
        self.setWindowTitle("ER图")
        self.setGeometry(100, 100, 1200, 800)
        self.setMinimumSize(900, 600)
        self.setStyleSheet("""
            QDialog {
                background-color: #f5f5f5;
                font-family: 'Segoe UI', 'Microsoft YaHei', Arial;
            }
            QToolBar {
                background-color: #f8f8f8;
                border: none;
                border-bottom: 1px solid #e0e0e0;
                padding: 4px;
                spacing: 4px;
            }
            QPushButton {
                background-color: #f0f0f0;
                border: 1px solid #c0c0c0;
                border-radius: 3px;
                padding: 6px 12px;
            }
            QPushButton:hover {
                background-color: #e0e0e0;
            }
            QPushButton:pressed {
                background-color: #d0d0d0;
            }
            QGraphicsView {
                border: 1px solid #d0d0d0;
                background-color: #ffffff;
            }
            QSpinBox {
                border: 1px solid #d0d0d0;
                border-radius: 3px;
                padding: 4px;
            }
        """)
        
        self.setup_ui()
        self.load_tables()
    
    def setup_ui(self):
        """设置UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        
        # 工具栏
        toolbar = QToolBar()
        
        refresh_btn = QPushButton("刷新")
        refresh_btn.clicked.connect(self.load_tables)
        toolbar.addWidget(refresh_btn)
        
        toolbar.addSeparator()
        
        auto_layout_btn = QPushButton("自动布局")
        auto_layout_btn.clicked.connect(self.auto_layout)
        toolbar.addWidget(auto_layout_btn)
        
        toolbar.addSeparator()
        
        export_btn = QPushButton("导出图片")
        export_btn.clicked.connect(self.export_image)
        toolbar.addWidget(export_btn)
        
        print_btn = QPushButton("打印")
        print_btn.clicked.connect(self.print_diagram)
        toolbar.addWidget(print_btn)
        
        toolbar.addSeparator()
        
        toolbar.addWidget(QLabel("缩放:"))
        self.zoom_slider = QSlider(Qt.Orientation.Horizontal)
        self.zoom_slider.setRange(25, 200)
        self.zoom_slider.setValue(100)
        self.zoom_slider.setMaximumWidth(150)
        self.zoom_slider.valueChanged.connect(self.on_zoom_changed)
        toolbar.addWidget(self.zoom_slider)
        
        zoom_label = QLabel("100%")
        self.zoom_label = zoom_label
        toolbar.addWidget(zoom_label)
        
        layout.addWidget(toolbar)
        
        # 图形视图
        self.scene = QGraphicsScene()
        self.scene.setSceneRect(-2000, -2000, 4000, 4000)
        
        self.graphics_view = QGraphicsView(self.scene)
        self.graphics_view.setDragMode(QGraphicsView.DragMode.ScrollHandDrag)
        self.graphics_view.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.graphics_view.setTransformationAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        
        layout.addWidget(self.graphics_view, 1)
        
        # 底部信息栏
        info_bar = QWidget()
        info_bar.setStyleSheet("background-color: #f0f0f0; padding: 4px 12px; border-top: 1px solid #e0e0e0;")
        info_layout = QHBoxLayout(info_bar)
        info_layout.setContentsMargins(0, 0, 0, 0)
        
        self.info_label = QLabel("准备生成ER图...")
        info_layout.addWidget(self.info_label)
        info_layout.addStretch()
        
        layout.addWidget(info_bar)
    
    def load_tables(self):
        """加载表结构"""
        self.scene.clear()
        self.table_items.clear()
        self.tables.clear()
        self.relations.clear()
        
        try:
            self.main_window.table_operations._ensure_database_context()
            
            with self.main_window.db_connection.cursor() as cursor:
                # 获取所有表
                if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                    cursor.execute("""
                        SELECT TABLE_NAME 
                        FROM INFORMATION_SCHEMA.TABLES 
                        WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'
                        ORDER BY TABLE_NAME
                    """, (self.main_window.current_db,))
                    table_names = [row[0] for row in cursor.fetchall()]
                    
                elif self.main_window.current_db_type == 'PostgreSQL':
                    cursor.execute("""
                        SELECT tablename 
                        FROM pg_tables 
                        WHERE schemaname = 'public'
                        ORDER BY tablename
                    """)
                    table_names = [row[0] for row in cursor.fetchall()]
                else:
                    table_names = []
                
                # 获取每个表的列信息
                for table_name in table_names:
                    columns = []
                    
                    if self.main_window.current_db_type in ('MySQL', 'MariaDB'):
                        cursor.execute("""
                            SELECT 
                                COLUMN_NAME,
                                DATA_TYPE,
                                COLUMN_KEY,
                                REFERENCED_TABLE_NAME,
                                REFERENCED_COLUMN_NAME
                            FROM INFORMATION_SCHEMA.COLUMNS
                            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                            ORDER BY ORDINAL_POSITION
                        """, (self.main_window.current_db, table_name))
                        
                        for row in cursor.fetchall():
                            columns.append({
                                'name': row[0],
                                'type': row[1],
                                'primary_key': row[2] == 'PRI',
                                'foreign_key': row[3] is not None,
                                'ref_table': row[3],
                                'ref_column': row[4]
                            })
                    
                    elif self.main_window.current_db_type == 'PostgreSQL':
                        cursor.execute("""
                            SELECT 
                                c.column_name,
                                c.data_type,
                                CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_pk
                            FROM information_schema.columns c
                            LEFT JOIN information_schema.key_column_usage kcu 
                                ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
                            LEFT JOIN information_schema.table_constraints tc 
                                ON kcu.constraint_name = tc.constraint_name
                            WHERE c.table_name = %s
                            ORDER BY c.ordinal_position
                        """, (table_name,))
                        
                        for row in cursor.fetchall():
                            columns.append({
                                'name': row[0],
                                'type': row[1],
                                'primary_key': row[2],
                                'foreign_key': False
                            })
                    
                    self.tables.append({
                        'name': table_name,
                        'columns': columns
                    })
            
            self.generate_er_diagram()
            self.info_label.setText(f"已加载 {len(self.tables)} 个表")
            
        except Exception as e:
            QMessageBox.critical(self, "加载失败", f"加载表结构时出错:\n{str(e)}")
            self.logger.log('ERROR', f"加载表结构失败: {str(e)}")
    
    def generate_er_diagram(self):
        """生成ER图"""
        import math
        
        # 计算布局
        n = len(self.tables)
        if n == 0:
            return
        
        cols = math.ceil(math.sqrt(n))
        rows = math.ceil(n / cols)
        
        spacing_x = 280
        spacing_y = 180
        start_x = 100
        start_y = 100
        
        for i, table in enumerate(self.tables):
            row = i // cols
            col = i % cols
            
            x = start_x + col * spacing_x
            y = start_y + row * spacing_y
            
            # 创建表项
            item = ERTableItem(table['name'], table['columns'], x, y)
            self.scene.addItem(item)
            self.table_items[table['name']] = item
            
            # 添加关系线
            for col in table['columns']:
                if col.get('foreign_key') and col.get('ref_table'):
                    ref_table = col['ref_table']
                    if ref_table in self.table_items:
                        relation_line = ERRelationLine(
                            item, col['name'],
                            self.table_items[ref_table], col.get('ref_column', 'id'),
                            "1:N"
                        )
                        self.scene.addItem(relation_line)
                        self.relations.append({
                            'from': table['name'],
                            'to': ref_table,
                            'from_col': col['name'],
                            'to_col': col.get('ref_column', 'id'),
                            'line': relation_line
                        })
        
        self.graphics_view.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)
    
    def auto_layout(self):
        """自动布局"""
        import random
        
        # 简单的力导向布局
        for _ in range(10):
            for table_name, item in self.table_items.items():
                # 随机移动一点点
                dx = random.uniform(-10, 10)
                dy = random.uniform(-10, 10)
                item.moveBy(dx, dy)
        
        # 更新关系线
        for relation in self.relations:
            relation['line'].update_line()
    
    def on_zoom_changed(self, value):
        """缩放变化"""
        scale = value / 100.0
        self.graphics_view.resetTransform()
        self.graphics_view.scale(scale, scale)
        self.zoom_label.setText(f"{value}%")
    
    def export_image(self):
        """导出图片"""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出ER图", "", 
            "PNG图片 (*.png);;JPEG图片 (*.jpg);;SVG矢量图 (*.svg)"
        )
        
        if not file_path:
            return
        
        try:
            rect = self.scene.sceneRect()
            pixmap = QPixmap(int(rect.width()), int(rect.height()))
            pixmap.fill(Qt.GlobalColor.white)
            
            painter = QPainter(pixmap)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)
            self.scene.render(painter)
            painter.end()
            
            pixmap.save(file_path)
            QMessageBox.information(self, "导出成功", f"ER图已保存到:\n{file_path}")
            
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出图片时出错:\n{str(e)}")
    
    def print_diagram(self):
        """打印ER图"""
        from PyQt6.QtPrintSupport import QPrinter
        printer = QPrinter()
        
        from PyQt6.QtWidgets import QPrintDialog
        dialog = QPrintDialog(printer, self)
        if dialog.exec():
            painter = QPainter(printer)
            painter.setRenderHint(QPainter.RenderHint.Antialiasing)
            self.scene.render(painter)
