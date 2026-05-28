#!/usr/bin/env python3
"""
数据传输模块 - 支持表数据比对分析
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QWidget,
                             QLabel, QComboBox, QMessageBox, QGroupBox, QGridLayout,
                             QTableWidget, QTableWidgetItem, QHeaderView, QSplitter,
                             QCheckBox, QProgressBar)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont, QColor

from core.sync_engine import SyncEngine
from core.database_worker import DatabaseWorker
from ui.components.sql_preview_dialog import SqlPreviewDialog


class DataTransfer(QDialog):
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.engine = SyncEngine(main_window)
        self._workers = []
        self._is_closing = False
        self._table_comparison_results = {}

        self.setWindowTitle("数据传输")
        self.resize(1200, 700)

        self._src_info_labels = []
        self._tgt_info_labels = []

        # 使用中心容器方式
        self._central_layout = QVBoxLayout(self)

        self._current_page = None
        self.show_initial_page()
        self._log_info("DataTransfer 初始化完成")

    def _log_info(self, message):
        if self.logger:
            self.logger.log('INFO', f"[DataTransfer] {message}")
        else:
            print(f"[INFO] [DataTransfer] {message}")

    def _log_error(self, message):
        if self.logger:
            self.logger.log('ERROR', f"[DataTransfer] {message}")
        else:
            print(f"[ERROR] [DataTransfer] {message}")

    def _load_conns(self, combo):
        combo.clear()
        combo.addItem("未选择")
        if self.main_window.saved_connections:
            for name in self.main_window.saved_connections.keys():
                combo.addItem(name)

    def _mk_title(self, text):
        label = QLabel(text)
        label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        label.setStyleSheet("color:#333;")
        return label

    def _mk_row(self, label_text, widget):
        w = QWidget()
        layout = QHBoxLayout(w)
        layout.setContentsMargins(0, 5, 0, 5)
        layout.addWidget(QLabel(label_text))
        layout.addWidget(widget)
        return w

    def _mk_info_group(self, label_list):
        g = QGroupBox("信息")
        grid = QGridLayout(g)
        labels = ["连接名:", "类型:", "主机:", "端口:"]
        for i, text in enumerate(labels):
            grid.addWidget(QLabel(text), i, 0)
            v = QLabel("未选择")
            v.setStyleSheet("color:#333;")
            grid.addWidget(v, i, 1)
            label_list.append(v)
        return g

    def _fill_info(self, labels, name):
        d = self.main_window.saved_connections.get(name)
        values = ["未选择", "未选择", "未选择", "未选择"]
        if d:
            values[0] = name
            values[1] = d.get('type', '未选择')
            values[2] = d.get('host', '未选择')
            values[3] = str(d.get('port', '未选择'))
        for i, v in enumerate(values):
            labels[i].setText(v)

    def _check_next_button(self):
        sc = self.source_conn.currentText()
        sd = self.source_db.currentText()
        tc = self.target_conn.currentText()
        td = self.target_db.currentText()

        can_proceed = bool(sc and sc != "未选择" and
                           sd and sd != "未选择" and
                           tc and tc != "未选择" and
                           td and td != "未选择")
        self.next_btn.setEnabled(can_proceed)
        self._log_info(f"下一步按钮状态: can_proceed={can_proceed}, type={type(can_proceed).__name__}, enabled={self.next_btn.isEnabled()}")

    def _swap(self):
        self._log_info("交换源和目标")
        sc = self.source_conn.currentText()
        sd = self.source_db.currentText()
        tc = self.target_conn.currentText()
        td = self.target_db.currentText()
        idx1 = self.source_conn.findText(tc)
        idx2 = self.target_conn.findText(sc)
        if idx1 >= 0:
            self.source_conn.setCurrentIndex(idx1)
        if idx2 >= 0:
            self.target_conn.setCurrentIndex(idx2)
        idx3 = self.source_db.findText(td)
        idx4 = self.target_db.findText(sd)
        if idx3 >= 0:
            self.source_db.setCurrentIndex(idx3)
        if idx4 >= 0:
            self.target_db.setCurrentIndex(idx4)

    def _update_top_labels(self):
        sc = self.source_conn.currentText()
        sd = self.source_db.currentText()
        tc = self.target_conn.currentText()
        td = self.target_db.currentText()

        if sc != "未选择" and sd != "未选择":
            self._src_label.setText(f"{sc}/{sd}")
        else:
            self._src_label.setText("未选择")

        if tc != "未选择" and td != "未选择":
            self._tgt_label.setText(f"{tc}/{td}")
        else:
            self._tgt_label.setText("未选择")
        self._check_next_button()

    def _on_src_conn_changed(self, name):
        self._log_info(f"源连接变更: {name}")
        self.source_db.clear()
        self.source_db.addItem("未选择")
        self.source_db.setEnabled(False)

        if name and name != "未选择":
            self._fill_info(self._src_info_labels, name)
            self._log_info(f"开始异步加载源数据库列表: {name}")
            worker = DatabaseWorker(self.engine, 'fetch_databases', name)
            worker.finished.connect(lambda dbs: self._on_src_dbs_loaded(dbs))
            worker.error.connect(lambda err: self._on_db_load_error(err))
            worker.finished.connect(worker.deleteLater)
            worker.error.connect(worker.deleteLater)
            self._workers.append(worker)
            worker.start()
        else:
            self._fill_info(self._src_info_labels, "")
            self._update_top_labels()

    def _on_tgt_conn_changed(self, name):
        self._log_info(f"目标连接变更: {name}")
        self.target_db.clear()
        self.target_db.addItem("未选择")
        self.target_db.setEnabled(False)

        if name and name != "未选择":
            self._fill_info(self._tgt_info_labels, name)
            self._log_info(f"开始异步加载目标数据库列表: {name}")
            worker = DatabaseWorker(self.engine, 'fetch_databases', name)
            worker.finished.connect(lambda dbs: self._on_tgt_dbs_loaded(dbs))
            worker.error.connect(lambda err: self._on_db_load_error(err))
            worker.finished.connect(worker.deleteLater)
            worker.error.connect(worker.deleteLater)
            self._workers.append(worker)
            worker.start()
        else:
            self._fill_info(self._tgt_info_labels, "")
            self._update_top_labels()

    def _on_src_dbs_loaded(self, dbs):
        self._log_info(f"源数据库列表加载完成: {len(dbs) if dbs else 0} 个")
        self.source_db.clear()
        self.source_db.addItem("未选择")
        if dbs:
            for db in dbs:
                self.source_db.addItem(db)
        self.source_db.setEnabled(True)
        self._update_top_labels()

    def _on_tgt_dbs_loaded(self, dbs):
        self._log_info(f"目标数据库列表加载完成: {len(dbs) if dbs else 0} 个")
        self.target_db.clear()
        self.target_db.addItem("未选择")
        if dbs:
            for db in dbs:
                self.target_db.addItem(db)
        self.target_db.setEnabled(True)
        self._update_top_labels()

    def _on_db_load_error(self, err):
        self._log_error(f"数据库列表加载失败: {err}")
        QMessageBox.critical(self, "加载失败", f"加载数据库列表失败:\n{err}")

    def show_initial_page(self):
        """显示初始页面"""
        self._log_info("显示初始页面")

        page = QWidget()
        main_layout = QVBoxLayout(page)

        # 顶部传输信息栏
        transfer_info = QWidget()
        ti = QHBoxLayout(transfer_info)
        ti.setContentsMargins(10, 5, 10, 5)
        self._src_label = QLabel("未选择")
        self._tgt_label = QLabel("未选择")
        arrow = QLabel("🢂")
        arrow.setFont(QFont("Arial", 14))
        ti.addWidget(self._src_label)
        ti.addStretch()
        ti.addWidget(arrow)
        ti.addStretch()
        ti.addWidget(self._tgt_label)
        main_layout.addWidget(transfer_info)

        # 内容区域
        content = QWidget()
        cl = QHBoxLayout(content)

        # 源连接区域
        src_grp = QWidget()
        sl = QVBoxLayout(src_grp)
        sl.setContentsMargins(10, 10, 10, 10)
        sl.addWidget(self._mk_title("源"))
        self.source_conn = QComboBox()
        self._load_conns(self.source_conn)
        sl.addWidget(self._mk_row("连接:", self.source_conn))
        self.source_db = QComboBox()
        sl.addWidget(self._mk_row("数据库:", self.source_db))
        self.source_db.addItem("未选择")
        self.source_db.setEnabled(False)
        self._src_info_labels = []
        sl.addWidget(self._mk_info_group(self._src_info_labels))
        cl.addWidget(src_grp)

        # 交换按钮区域
        mid = QVBoxLayout()
        self.swap_btn = QPushButton("⇄")
        self.swap_btn.setFixedSize(36, 36)
        self.swap_btn.clicked.connect(self._swap)
        mid.addWidget(self.swap_btn)
        mid.addStretch()
        cl.addLayout(mid)

        # 目标连接区域
        tgt_grp = QWidget()
        tl = QVBoxLayout(tgt_grp)
        tl.setContentsMargins(10, 10, 10, 10)
        tl.addWidget(self._mk_title("目标"))
        self.target_conn = QComboBox()
        self._load_conns(self.target_conn)
        tl.addWidget(self._mk_row("连接:", self.target_conn))
        self.target_db = QComboBox()
        tl.addWidget(self._mk_row("数据库:", self.target_db))
        self.target_db.addItem("未选择")
        self.target_db.setEnabled(False)
        self._tgt_info_labels = []
        tl.addWidget(self._mk_info_group(self._tgt_info_labels))
        cl.addWidget(tgt_grp)
        main_layout.addWidget(content)

        # 底部按钮栏
        btns = QHBoxLayout()
        btns.addStretch()
        self.next_btn = QPushButton("下一步 →")
        self.next_btn.setStyleSheet(
            "QPushButton{padding:6px 24px;background:#007ACC;color:white;border-radius:3px;}"
            "QPushButton:hover{background:#005FA0;}"
            "QPushButton:disabled{background:#CCC;color:#888;}"
        )
        self.next_btn.clicked.connect(self._on_next)
        self.next_btn.setEnabled(False)
        btns.addWidget(self.next_btn)
        main_layout.addLayout(btns)

        # 连接信号槽
        self.source_conn.currentTextChanged.connect(self._on_src_conn_changed)
        self.target_conn.currentTextChanged.connect(self._on_tgt_conn_changed)
        self.source_db.currentTextChanged.connect(self._update_top_labels)
        self.target_db.currentTextChanged.connect(self._update_top_labels)

        # 切换页面
        self._switch_page(page)

    def _switch_page(self, new_page):
        """切换到新页面"""
        self._log_info(f"切换页面: {new_page.__class__.__name__}")

        if self._current_page:
            self._central_layout.removeWidget(self._current_page)
            self._current_page.setParent(None)
            self._current_page.deleteLater()

        self._current_page = new_page
        self._central_layout.addWidget(self._current_page)
        self._central_layout.update()
        self.update()
        self.repaint()

    def _on_next(self):
        """处理下一步按钮点击"""
        self._log_info("===== 下一步按钮被点击 =====")
        sc = self.source_conn.currentText()
        sd = self.source_db.currentText()
        tc = self.target_conn.currentText()
        td = self.target_db.currentText()

        self._log_info(f"当前选择: 源={sc}/{sd}, 目标={tc}/{td}")

        if not sc or not sd or not tc or not td:
            self._log_info("连接信息不完整")
            QMessageBox.warning(self, "提示", "请选择完整的源和目标连接及数据库")
            return

        self._log_info("开始显示表比对页面")
        self.show_table_compare_page(sc, sd, tc, td)

    def show_table_compare_page(self, sc, sd, tc, td):
        """显示表比对页面"""
        self._log_info(f"显示表比对页面: {sc}/{sd} -> {tc}/{td}")

        page = QWidget()
        main_layout = QVBoxLayout(page)

        # 顶部信息栏
        info = QWidget()
        ti = QHBoxLayout(info)
        ti.setContentsMargins(10, 5, 10, 5)
        s = QLabel(f"{sc}/{sd}")
        t = QLabel(f"{tc}/{td}")
        arrow = QLabel("🢂")
        arrow.setFont(QFont("Arial", 14))
        ti.addWidget(s)
        ti.addStretch()
        ti.addWidget(arrow)
        ti.addStretch()
        ti.addWidget(t)
        main_layout.addWidget(info)

        # 比对进度区域
        progress_widget = QWidget()
        progress_layout = QVBoxLayout(progress_widget)
        
        self._compare_progress = QLabel("⏳ 正在比对表数据...")
        progress_layout.addWidget(self._compare_progress)
        
        # 进度条
        self._progress_bar = QProgressBar()
        self._progress_bar.setRange(0, 100)
        self._progress_bar.setValue(0)
        self._progress_bar.setTextVisible(True)
        progress_layout.addWidget(self._progress_bar)
        
        # 当前表信息
        self._current_table_label = QLabel("")
        self._current_table_label.setStyleSheet("color: #666; font-size: 12px;")
        progress_layout.addWidget(self._current_table_label)
        
        main_layout.addWidget(progress_widget)

        # 表比对结果表格
        self._compare_table = QTableWidget()
        self._compare_table.setColumnCount(9)
        self._compare_table.setHorizontalHeaderLabels([
            "源表", "目标表", "源行数", "目标行数",
            "新增", "更新", "删除", "同步", "状态"
        ])
        self._compare_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self._compare_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self._compare_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self._compare_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self._compare_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self._compare_table.horizontalHeader().setSectionResizeMode(5, QHeaderView.ResizeMode.Fixed)
        self._compare_table.horizontalHeader().setSectionResizeMode(6, QHeaderView.ResizeMode.Fixed)
        self._compare_table.horizontalHeader().setSectionResizeMode(7, QHeaderView.ResizeMode.Fixed)
        self._compare_table.horizontalHeader().setSectionResizeMode(8, QHeaderView.ResizeMode.Fixed)
        self._compare_table.setColumnWidth(2, 80)
        self._compare_table.setColumnWidth(3, 80)
        self._compare_table.setColumnWidth(4, 80)
        self._compare_table.setColumnWidth(5, 80)
        self._compare_table.setColumnWidth(6, 80)
        self._compare_table.setColumnWidth(7, 80)
        self._compare_table.setColumnWidth(8, 100)
        self._compare_table.setMinimumHeight(300)
        self._compare_table.setStyleSheet("""
            QTableWidget {
                gridline-color: #ddd;
                border: 1px solid #ccc;
            }
            QTableWidget::item {
                padding: 8px;
                border-bottom: 1px solid #eee;
            }
            QTableWidget::item:hover {
                background-color: #f5f5f5;
            }
        """)
        main_layout.addWidget(self._compare_table)

        # 差异详情区域
        detail_group = QGroupBox("数据预览")
        detail_layout = QHBoxLayout(detail_group)
        
        # 源表数据预览
        self._src_detail = QTableWidget()
        self._src_detail.setWindowTitle("源表数据")
        self._src_detail.setStyleSheet("""
            QTableWidget {
                border: 1px solid #ccc;
                background-color: #fafafa;
            }
        """)
        
        # 箭头标签
        arrow_label = QLabel("🡢")
        arrow_label.setFont(QFont("Arial", 20))
        arrow_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        arrow_label.setStyleSheet("color: #007ACC;")
        
        # 目标表数据预览
        self._tgt_detail = QTableWidget()
        self._tgt_detail.setWindowTitle("目标表数据")
        self._tgt_detail.setStyleSheet("""
            QTableWidget {
                border: 1px solid #ccc;
                background-color: #fafafa;
            }
        """)

        detail_layout.addWidget(self._src_detail)
        detail_layout.addWidget(arrow_label)
        detail_layout.addWidget(self._tgt_detail)
        
        # 设置最小高度和比例
        detail_group.setMinimumHeight(200)
        main_layout.addWidget(detail_group)

        # 保存连接信息
        self._src_conn = sc
        self._src_db = sd
        self._tgt_conn = tc
        self._tgt_db = td

        # 底部按钮栏
        btns = QHBoxLayout()

        # 全选/全不选按钮
        self._select_all_btn = QPushButton("全选")
        self._select_all_btn.clicked.connect(self._select_all)
        btns.addWidget(self._select_all_btn)

        self._deselect_all_btn = QPushButton("全不选")
        self._deselect_all_btn.clicked.connect(self._deselect_all)
        btns.addWidget(self._deselect_all_btn)

        # 只选择有差异的表
        self._select_diff_btn = QPushButton("只选有差异")
        self._select_diff_btn.clicked.connect(self._select_only_diff)
        btns.addWidget(self._select_diff_btn)

        btns.addStretch()

        self._start_btn = QPushButton("⏳ 比对中...")
        self._start_btn.setStyleSheet(
            "QPushButton{padding:6px 24px;background:#007ACC;color:white;border-radius:3px;}"
            "QPushButton:hover{background:#005FA0;}"
            "QPushButton:disabled{background:#CCC;color:#888;}"
        )
        self._start_btn.setEnabled(False)
        btns.addWidget(self._start_btn)
        btns.addStretch()

        back = QPushButton("← 上一步")
        back.clicked.connect(self.show_initial_page)
        btns.addWidget(back)
        main_layout.addLayout(btns)

        # 切换页面
        self._switch_page(page)

        # 异步加载两边的表列表并比对
        self._log_info("开始异步加载源表和目标表列表进行比对")
        self._load_tables_for_compare(sc, sd, tc, td)

    def _load_tables_for_compare(self, sc, sd, tc, td):
        """异步加载源表和目标表列表进行比对"""
        # 先加载源表列表
        src_worker = DatabaseWorker(self.engine, 'fetch_tables', sc, sd)
        src_worker.finished.connect(lambda src_tables: self._on_src_tables_loaded_for_compare(src_tables, tc, td))
        src_worker.error.connect(lambda err: self._on_compare_error(err))
        src_worker.finished.connect(src_worker.deleteLater)
        src_worker.error.connect(src_worker.deleteLater)
        self._workers.append(src_worker)
        src_worker.start()

    def _on_src_tables_loaded_for_compare(self, src_tables, tc, td):
        """源表列表加载完成，继续加载目标表列表"""
        self._src_tables = src_tables if src_tables else []

        def on_tgt_loaded(tgt_tables):
            self._on_both_tables_loaded(self._src_tables, tgt_tables)

        tgt_worker = DatabaseWorker(self.engine, 'fetch_tables', tc, td)
        tgt_worker.finished.connect(on_tgt_loaded)
        tgt_worker.error.connect(lambda err: self._on_compare_error(err))
        tgt_worker.finished.connect(tgt_worker.deleteLater)
        tgt_worker.error.connect(tgt_worker.deleteLater)
        self._workers.append(tgt_worker)
        tgt_worker.start()

    def _on_both_tables_loaded(self, src_tables, tgt_tables):
        """两边表列表都加载完成，开始比对"""
        self._tgt_tables = tgt_tables if tgt_tables else []
        self._log_info(f"开始比对: 源表 {len(src_tables)} 张, 目标表 {len(self._tgt_tables)} 张")

        # 创建比对工作线程
        try:
            self._log_info(f"创建比对工作线程，参数: {self._src_conn}, {self._src_db}, {self._tgt_conn}, {self._tgt_db}")
            tables_list = list(set(src_tables + self._tgt_tables))
            self._log_info(f"需要比对的表数量: {len(tables_list)}")
            
            # 保存表总数用于进度计算
            self._total_tables = len(tables_list)
            self._current_table_index = 0

            # 使用 DatabaseWorker 执行比对操作
            worker = DatabaseWorker(self.engine, 'compare_all_tables',
                                   self._src_conn, self._src_db,
                                   self._tgt_conn, self._tgt_db,
                                   tables_list)
            worker.finished.connect(self._on_compare_finished)
            worker.error.connect(self._on_compare_error)
            worker.progress.connect(self._on_compare_progress)
            worker.finished.connect(worker.deleteLater)
            worker.error.connect(worker.deleteLater)
            self._workers.append(worker)
            self._log_info("启动比对工作线程")
            worker.start()
        except Exception as e:
            self._log_error(f"创建比对工作线程失败: {e}")
            self._on_compare_error(str(e))

    def _on_compare_progress(self, table_name, progress):
        """比对进度回调"""
        self._current_table_label.setText(f"当前表: {table_name}")
        
        # 解析进度信息
        if isinstance(progress, str) and '/' in progress:
            try:
                current, total = progress.split('/')
                self._current_table_index = int(current)
                total_tables = int(total)
                percentage = int((self._current_table_index / total_tables) * 100)
                self._progress_bar.setValue(percentage)
                self._compare_progress.setText(f"⏳ 正在比对表数据... ({progress})")
            except ValueError:
                self._compare_progress.setText(f"⏳ 正在比对: {table_name}")
        else:
            self._compare_progress.setText(f"⏳ 正在比对: {table_name}")
        
        self._log_info(f"比对进度: {table_name} - {progress}")

    def _on_compare_finished(self, results):
        """比对完成"""
        self._log_info(f"比对完成: {len(results)} 张表")
        self._table_comparison_results = results

        # 更新表格
        self._compare_table.setRowCount(0)

        total_insert = 0
        total_update = 0
        total_delete = 0

        for table_name, result in results.items():
            row = self._compare_table.rowCount()
            self._compare_table.insertRow(row)

            # 源表名
            src_name = table_name if table_name in self._src_tables else "-"
            src_item = QTableWidgetItem(src_name)
            src_item.setToolTip(f"源表: {src_name}")
            self._compare_table.setItem(row, 0, src_item)

            # 目标表名
            tgt_name = table_name if table_name in self._tgt_tables else "-"
            tgt_item = QTableWidgetItem(tgt_name)
            tgt_item.setToolTip(f"目标表: {tgt_name}")
            self._compare_table.setItem(row, 1, tgt_item)

            # 源行数
            src_count = result.get('src_count', 0)
            src_count_item = QTableWidgetItem(str(src_count))
            src_count_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._compare_table.setItem(row, 2, src_count_item)

            # 目标行数
            tgt_count = result.get('tgt_count', 0)
            tgt_count_item = QTableWidgetItem(str(tgt_count))
            tgt_count_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._compare_table.setItem(row, 3, tgt_count_item)

            # 新增数量和勾选框
            insert_count = result.get('insert_count', 0)
            total_insert += insert_count
            insert_widget = self._create_operation_widget(insert_count, "新增")
            self._compare_table.setCellWidget(row, 4, insert_widget)

            # 更新数量和勾选框
            update_count = result.get('update_count', 0)
            total_update += update_count
            update_widget = self._create_operation_widget(update_count, "更新")
            self._compare_table.setCellWidget(row, 5, update_widget)

            # 删除数量和勾选框
            delete_count = result.get('delete_count', 0)
            total_delete += delete_count
            delete_widget = self._create_operation_widget(delete_count, "删除")
            self._compare_table.setCellWidget(row, 6, delete_widget)

            # 同步勾选框（全选）
            sync_checkbox = QCheckBox()
            sync_checkbox.setChecked(True)
            sync_checkbox.stateChanged.connect(
                lambda state, r=row: self._on_sync_checkbox_changed(r, state)
            )
            sync_widget = QWidget()
            sync_layout = QHBoxLayout(sync_widget)
            sync_layout.setContentsMargins(0, 0, 0, 0)
            sync_layout.addWidget(sync_checkbox)
            sync_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self._compare_table.setCellWidget(row, 7, sync_widget)

            # 状态
            status = self._get_status(result, src_count, tgt_count)
            status_item = QTableWidgetItem(status)
            status_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            status_item.setToolTip(f"状态: {status}")
            if "完全一致" in status:
                status_item.setBackground(QColor(200, 255, 200))
                status_item.setForeground(QColor(0, 128, 0))
            elif "有差异" in status:
                status_item.setBackground(QColor(255, 255, 200))
                status_item.setForeground(QColor(128, 128, 0))
            elif "仅源有" in status:
                status_item.setBackground(QColor(255, 200, 200))
                status_item.setForeground(QColor(128, 0, 0))
            elif "仅目标有" in status:
                status_item.setBackground(QColor(200, 200, 255))
                status_item.setForeground(QColor(0, 0, 128))
            elif "两边都为空" in status:
                status_item.setBackground(QColor(240, 240, 240))
                status_item.setForeground(QColor(128, 128, 128))
            self._compare_table.setItem(row, 8, status_item)

        self._progress_bar.setValue(100)
        self._current_table_label.setText("")
        self._compare_progress.setText(f"✅ 比对完成 | 新增:{total_insert} | 更新:{total_update} | 删除:{total_delete}")
        self._start_btn.setText("▶ 开始传输")
        self._start_btn.setEnabled(True)
        self._start_btn.clicked.connect(self._start_transfer)

        # 点击表格行查看详情
        self._compare_table.itemClicked.connect(self._on_table_row_clicked)

    def _get_status(self, result, src_count, tgt_count):
        """获取状态描述"""
        insert = result.get('insert_count', 0)
        update = result.get('update_count', 0)
        delete = result.get('delete_count', 0)

        if src_count == 0 and tgt_count == 0:
            return "两边都为空"
        elif src_count == 0:
            return "仅目标有"
        elif tgt_count == 0:
            return "仅源有"
        elif insert == 0 and update == 0 and delete == 0:
            return "完全一致"
        else:
            return "有差异"

    def _on_table_row_clicked(self, item):
        """点击表格行查看详情"""
        row = item.row()
        src_table = self._compare_table.item(row, 0).text()
        tgt_table = self._compare_table.item(row, 1).text()

        if src_table != "-":
            self._load_table_preview(src_table, True)
        if tgt_table != "-":
            self._load_table_preview(tgt_table, False)

    def _load_table_preview(self, table_name, is_source):
        """加载表数据预览"""
        conn = self._src_conn if is_source else self._tgt_conn
        db = self._src_db if is_source else self._tgt_db

        worker = DatabaseWorker(self.engine, 'preview_table', conn, db, table_name)
        if is_source:
            worker.finished.connect(lambda data: self._on_preview_loaded(data, True))
        else:
            worker.finished.connect(lambda data: self._on_preview_loaded(data, False))
        worker.error.connect(lambda err: self._log_error(f"预览表失败: {err}"))
        worker.finished.connect(worker.deleteLater)
        worker.error.connect(worker.deleteLater)
        self._workers.append(worker)
        worker.start()

    def _on_preview_loaded(self, data, is_source):
        """表预览加载完成"""
        table = self._src_detail if is_source else self._tgt_detail
        table.clear()

        if not data or len(data) == 0:
            return

        # 设置列
        headers = list(data[0].keys())
        table.setColumnCount(len(headers))
        table.setHorizontalHeaderLabels(headers)
        
        # 设置列宽
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        for i, header in enumerate(headers):
            table.setColumnWidth(i, min(200, max(80, len(header) * 12)))

        # 设置行
        table.setRowCount(len(data))
        table.setMaximumHeight(250)
        
        # 应用样式
        table.setStyleSheet("""
            QTableWidget {
                border: 1px solid #ccc;
                background-color: white;
                gridline-color: #e0e0e0;
            }
            QTableWidget::item {
                padding: 4px 8px;
                font-size: 11px;
                color: #333;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #1565c0;
            }
            QHeaderView::section {
                background-color: #f5f5f5;
                padding: 6px;
                font-weight: bold;
                font-size: 12px;
                color: #555;
                border-bottom: 2px solid #ddd;
            }
        """)
        
        for i, row in enumerate(data):
            for j, col in enumerate(headers):
                item = QTableWidgetItem(str(row[col]))
                item.setToolTip(f"{col}: {row[col]}")
                table.setItem(i, j, item)

    def _create_operation_widget(self, count, operation_type):
        """创建操作列的widget（包含勾选框和数量）"""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(2, 2, 2, 2)
        layout.setSpacing(4)
        
        checkbox = QCheckBox()
        
        label = QLabel(str(count))
        label.setStyleSheet("font-size: 12px;")
        label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        if count > 0:
            checkbox.setChecked(True)
            
            if operation_type == "新增":
                label.setStyleSheet("font-size: 12px; color: #2E7D32; font-weight: bold;")
                checkbox.setStyleSheet("QCheckBox::indicator { width: 16px; height: 16px; }")
            elif operation_type == "更新":
                label.setStyleSheet("font-size: 12px; color: #F57C00; font-weight: bold;")
                checkbox.setStyleSheet("QCheckBox::indicator { width: 16px; height: 16px; }")
            elif operation_type == "删除":
                label.setStyleSheet("font-size: 12px; color: #C62828; font-weight: bold;")
        else:
            # 数量为0时，禁用复选框并置灰
            checkbox.setChecked(False)
            checkbox.setEnabled(False)
            checkbox.setStyleSheet("QCheckBox::indicator { width: 16px; height: 16px; } QCheckBox { color: #999999; }")
            label.setStyleSheet("font-size: 12px; color: #999999;")
        
        layout.addWidget(checkbox)
        layout.addWidget(label)
        layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        return widget

    def _on_sync_checkbox_changed(self, row, state):
        """同步勾选框状态改变时，同步更新新增/更新/删除的勾选状态"""
        checked = (state == 2)  # Qt.CheckState.Checked
        for col in range(4, 7):  # 新增、更新、删除列
            widget = self._compare_table.cellWidget(row, col)
            if widget:
                checkbox = widget.findChild(QCheckBox)
                if checkbox:
                    checkbox.setChecked(checked)

    def _on_compare_error(self, err):
        """比对错误"""
        self._log_error(f"比对失败: {err}")
        self._compare_progress.setText("❌ 比对失败")
        QMessageBox.critical(self, "比对失败", f"表数据比对失败:\n{err}")

    def _select_all(self):
        """全选所有同步选项"""
        for i in range(self._compare_table.rowCount()):
            # 同步勾选框
            sync_widget = self._compare_table.cellWidget(i, 7)
            if sync_widget:
                checkbox = sync_widget.findChild(QCheckBox)
                if checkbox:
                    checkbox.setChecked(True)
            # 更新操作列勾选框
            for col in range(4, 7):
                widget = self._compare_table.cellWidget(i, col)
                if widget:
                    checkbox = widget.findChild(QCheckBox)
                    if checkbox:
                        checkbox.setChecked(True)

    def _deselect_all(self):
        """全不选所有同步选项"""
        for i in range(self._compare_table.rowCount()):
            # 同步勾选框
            sync_widget = self._compare_table.cellWidget(i, 7)
            if sync_widget:
                checkbox = sync_widget.findChild(QCheckBox)
                if checkbox:
                    checkbox.setChecked(False)
            # 更新操作列勾选框
            for col in range(4, 7):
                widget = self._compare_table.cellWidget(i, col)
                if widget:
                    checkbox = widget.findChild(QCheckBox)
                    if checkbox:
                        checkbox.setChecked(False)

    def _select_only_diff(self):
        """只选择有差异的表"""
        for i in range(self._compare_table.rowCount()):
            status = self._compare_table.item(i, 8).text()
            has_diff = "差异" in status or "仅源有" in status
            
            # 同步勾选框
            sync_widget = self._compare_table.cellWidget(i, 7)
            if sync_widget:
                checkbox = sync_widget.findChild(QCheckBox)
                if checkbox:
                    checkbox.setChecked(has_diff)
            
            # 更新操作列勾选框（只有有差异时才勾选）
            if has_diff:
                for col in range(4, 7):
                    widget = self._compare_table.cellWidget(i, col)
                    if widget:
                        checkbox = widget.findChild(QCheckBox)
                        label = widget.findChild(QLabel)
                        if checkbox and label and int(label.text()) > 0:
                            checkbox.setChecked(True)

    def _start_transfer(self):
        """开始数据传输"""
        self._log_info("开始数据传输")
        selected = []
        operations = []
        
        for i in range(self._compare_table.rowCount()):
            table_name = self._compare_table.item(i, 0).text()
            if table_name == "-":
                continue
            
            # 获取各操作的勾选状态
            insert_widget = self._compare_table.cellWidget(i, 4)
            update_widget = self._compare_table.cellWidget(i, 5)
            delete_widget = self._compare_table.cellWidget(i, 6)
            
            insert_checked = False
            update_checked = False
            delete_checked = False
            
            if insert_widget:
                checkbox = insert_widget.findChild(QCheckBox)
                if checkbox:
                    insert_checked = checkbox.isChecked()
            if update_widget:
                checkbox = update_widget.findChild(QCheckBox)
                if checkbox:
                    update_checked = checkbox.isChecked()
            if delete_widget:
                checkbox = delete_widget.findChild(QCheckBox)
                if checkbox:
                    delete_checked = checkbox.isChecked()
            
            # 如果有任何操作被勾选，则选中该表
            if insert_checked or update_checked or delete_checked:
                selected.append(table_name)
                operations.append({
                    'table': table_name,
                    'insert': insert_checked,
                    'update': update_checked,
                    'delete': delete_checked
                })

        if not selected:
            QMessageBox.warning(self, "提示", "请至少选择一个操作")
            return

        # 保存操作配置
        self._transfer_operations = operations
        self._selected_tables = selected
        
        # 先生成SQL语句预览
        self._start_btn.setEnabled(False)
        self._compare_progress.setText("⏳ 正在生成SQL语句...")
        
        worker = DatabaseWorker(self.engine, 'generate_transfer_sql',
                               self._src_conn, self._src_db,
                               self._tgt_conn, self._tgt_db, selected,
                               operations=operations)
        worker.finished.connect(self._on_sql_generated)
        worker.error.connect(self._on_sql_generate_error)
        worker.finished.connect(worker.deleteLater)
        worker.error.connect(worker.deleteLater)
        self._workers.append(worker)
        worker.start()

    def _on_sql_generated(self, sql_statements):
        """SQL生成完成回调"""
        self._compare_progress.setText("SQL生成完成")
        
        # 显示SQL预览对话框
        dialog = SqlPreviewDialog(sql_statements, self)
        dialog.execute_sql.connect(self._confirm_execute_transfer)
        result = dialog.exec()
        
        if result == QDialog.DialogCode.Rejected:
            # 用户取消
            self._compare_progress.setText("传输已取消")
            self._start_btn.setEnabled(True)
    
    def _on_sql_generate_error(self, error):
        """SQL生成失败回调"""
        QMessageBox.critical(self, "错误", f"生成SQL语句失败: {error}")
        self._compare_progress.setText("SQL生成失败")
        self._start_btn.setEnabled(True)
    
    def _confirm_execute_transfer(self):
        """用户确认后执行传输"""
        # 重置进度条
        self._progress_bar.setValue(0)
        self._total_tables = len(self._selected_tables)
        self._current_table_index = 0
        
        self._compare_progress.setText("⏳ 正在传输数据...")
        
        worker = DatabaseWorker(self.engine, 'transfer_tables',
                               self._src_conn, self._src_db,
                               self._tgt_conn, self._tgt_db, self._selected_tables,
                               operations=self._transfer_operations)
        worker.finished.connect(self._on_transfer_finished)
        worker.error.connect(self._on_transfer_error)
        worker.progress.connect(self._on_transfer_progress)
        worker.finished.connect(worker.deleteLater)
        worker.error.connect(worker.deleteLater)
        self._workers.append(worker)
        worker.start()
    
    def _on_transfer_progress(self, table_name, progress):
        """传输进度回调"""
        self._current_table_label.setText(f"当前表: {table_name}")
        
        if progress == "开始":
            pass
        elif progress == "完成":
            self._current_table_index += 1
            percentage = int((self._current_table_index / self._total_tables) * 100)
            self._progress_bar.setValue(percentage)
        elif progress == "失败":
            self._current_table_index += 1
        
        progress_text = f"{self._current_table_index}/{self._total_tables}"
        self._compare_progress.setText(f"⏳ 正在传输数据... ({progress_text})")
        self._log_info(f"传输进度: {table_name} - {progress}")

    def _on_transfer_finished(self, result):
        """传输完成"""
        self._log_info(f"传输完成: {result}")
        self._progress_bar.setValue(100)
        self._current_table_label.setText("")
        success_count = result.get('success', 0)
        failed_count = result.get('failed', 0)
        if failed_count > 0:
            self._compare_progress.setText(f"⚠️ 传输完成 | 成功:{success_count} | 失败:{failed_count}")
        else:
            self._compare_progress.setText(f"✅ 传输完成 | 成功:{success_count}")
        self._start_btn.setText("▶ 开始传输")
        self._start_btn.setEnabled(True)
        QMessageBox.information(self, "传输完成", f"成功传输 {success_count} 张表")

    def _on_transfer_error(self, err):
        """传输错误"""
        self._log_error(f"传输失败: {err}")
        self._compare_progress.setText("❌ 传输失败")
        self._start_btn.setText("▶ 开始传输")
        self._start_btn.setEnabled(True)
        QMessageBox.critical(self, "传输失败", f"数据传输失败:\n{err}")

    def closeEvent(self, event):
        """关闭对话框时清理工作线程"""
        self._log_info("DataTransfer 对话框关闭, 清理工作线程")
        self._is_closing = True

        for worker in self._workers[:]:
            try:
                if worker and worker.isRunning():
                    worker.stop()
            except RuntimeError:
                pass
        self._workers.clear()
        event.accept()
