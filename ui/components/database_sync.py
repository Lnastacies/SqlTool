#!/usr/bin/env python3
"""
数据库同步主页面模块
"""

import traceback
from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QTabWidget, QWidget,
                            QLabel, QComboBox, QTableWidget, QTableWidgetItem,
                            QCheckBox, QGridLayout, QGroupBox, QHeaderView, QMessageBox,
                            QStackedWidget, QTextEdit, QSplitter, QAbstractItemView,
                            QFrame, QLineEdit, QApplication, QScrollArea)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QColor, QBrush, QFont, QTextCursor
import datetime

from core.sync_engine import SyncEngine
from core.database_worker import DatabaseWorker, DatabaseSyncWorker

class DatabaseSync(QDialog):
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.engine = SyncEngine(main_window)

        self.setWindowTitle("数据同步")
        self.resize(1280, 860)

        self.current_page = "main"
        self._cache = {}
        self._selected_table = None
        
        self._workers = []

        self.stacked_widget = QStackedWidget()
        self.main_page = QWidget()
        self.table_list_page = QWidget()
        self.result_page = QWidget()
        self.sql_preview_page = QWidget()

        self._log_info("DatabaseSync 初始化完成")
        self.setup_ui()
        self.load_source_connections()
        self.load_target_connections()
        self.load_source_databases()
        self.load_target_databases()
        self._update_top()

    def _log_info(self, message):
        """记录信息日志"""
        if self.logger:
            self.logger.log('INFO', f"[DatabaseSync] {message}")
        else:
            print(f"[INFO] [DatabaseSync] {message}")

    def _log_error(self, message):
        """记录错误日志"""
        if self.logger:
            self.logger.log('ERROR', f"[DatabaseSync] {message}")
        else:
            print(f"[ERROR] [DatabaseSync] {message}")

    def setup_ui(self):
        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self._setup_main_page()
        self._setup_table_list_page()
        self._setup_result_page()
        self._setup_sql_preview_page()
        for p in [self.main_page, self.table_list_page, self.result_page, self.sql_preview_page]:
            self.stacked_widget.addWidget(p)
        self.stacked_widget.setCurrentWidget(self.main_page)
        self.main_layout.addWidget(self.stacked_widget)

    NAV_STYLE = """
        QGroupBox{font-size:12px;font-weight:bold;border:1px solid #C8C8C8;border-radius:4px;margin-top:10px;padding-top:16px;}
        QGroupBox::title{subcontrol-origin:margin;left:10px;padding:0 4px;}
        QTableWidget{border:1px solid #C8C8C8;gridline-color:#E0E0E0;font-size:12px;selection-background-color:#E3F2FD;}
        QTableWidget::item{padding:4px 8px;}
        QHeaderView::section{background-color:#F0F0F0;border:1px solid #C8C8C8;padding:5px 8px;font-weight:bold;font-size:12px;color:#333;}
        QPushButton{padding:6px 18px;border:1px solid #C0C0C0;border-radius:3px;background-color:#FAFAFA;font-size:12px;min-width:80px;}
        QPushButton:hover{background-color:#E3F2FD;border-color:#007ACC;}
        QPushButton:pressed{background-color:#BBDEFB;}
        QLineEdit{border:1px solid #C8C8C8;border-radius:3px;padding:4px 8px;font-size:12px;}
        QSplitter::handle{background-color:#D0D0D0;height:3px;}
    """

    def _primary_btn(self, btn):
        btn.setStyleSheet(
            "QPushButton{padding:6px 24px;border:1px solid #007ACC;border-radius:3px;background-color:#007ACC;color:white;font-size:12px;min-width:90px;}"
            "QPushButton:hover{background-color:#005FA0;}QPushButton:pressed{background-color:#004D87;}")

    # ========== 页面1：主页面 ==========
    def _setup_main_page(self):
        self.main_page.setStyleSheet(self.NAV_STYLE)
        layout = QVBoxLayout(self.main_page); layout.setContentsMargins(10, 10, 10, 10)
        sf = QFrame(); sf.setStyleSheet("QFrame{background:#F5F8FA;border:1px solid #D0D0D0;border-radius:4px;padding:6px;}")
        sbar = QHBoxLayout(sf); sbar.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.src_conn_label = QLabel("未选择"); self.src_conn_label.setStyleSheet("font-size:13px;font-weight:bold;color:#2E7D32;")
        self.src_db_label = QLabel("未选择"); self.src_db_label.setStyleSheet("font-size:11px;color:#555;")
        arrow = QLabel("  ⟹  "); arrow.setStyleSheet("font-size:18px;color:#999;")
        self.tgt_conn_label = QLabel("未选择"); self.tgt_conn_label.setStyleSheet("font-size:13px;font-weight:bold;color:#1565C0;")
        self.tgt_db_label = QLabel("未选择"); self.tgt_db_label.setStyleSheet("font-size:11px;color:#555;")
        sbar.addWidget(QLabel("🖥 ")); sbar.setSpacing(2)
        sv = QVBoxLayout(); sv.setSpacing(0); sv.addWidget(self.src_conn_label); sv.addWidget(self.src_db_label)
        sw = QWidget(); sw.setLayout(sv); sbar.addWidget(sw); sbar.addWidget(arrow)
        sbar.addWidget(QLabel("🖥 "))
        tv = QVBoxLayout(); tv.setSpacing(0); tv.addWidget(self.tgt_conn_label); tv.addWidget(self.tgt_db_label)
        tw = QWidget(); tw.setLayout(tv); sbar.addWidget(tw)
        layout.addWidget(sf)
        self.tab_widget = QTabWidget()
        nt = QWidget(); nl = QVBoxLayout(nt)
        sel = QHBoxLayout()
        sg = QGroupBox("源"); sgl = QVBoxLayout(sg)
        r1 = QHBoxLayout(); r1.addWidget(QLabel("连接:"))
        self.source_conn_combo = QComboBox(); r1.addWidget(self.source_conn_combo); sgl.addLayout(r1)
        r2 = QHBoxLayout(); r2.addWidget(QLabel("数据库:"))
        self.source_db_combo = QComboBox(); r2.addWidget(self.source_db_combo); sgl.addLayout(r2); sel.addWidget(sg)
        self.swap_btn = QPushButton("⇄"); self.swap_btn.setFixedSize(36, 36)
        self.swap_btn.clicked.connect(self._swap_source_target); sel.addWidget(self.swap_btn)
        tg = QGroupBox("目标"); tgl = QVBoxLayout(tg)
        r3 = QHBoxLayout(); r3.addWidget(QLabel("连接:"))
        self.target_conn_combo = QComboBox(); r3.addWidget(self.target_conn_combo); tgl.addLayout(r3)
        r4 = QHBoxLayout(); r4.addWidget(QLabel("数据库:"))
        self.target_db_combo = QComboBox(); r4.addWidget(self.target_db_combo); tgl.addLayout(r4)
        sel.addWidget(tg); nl.addLayout(sel)
        il = QHBoxLayout()
        self.src_info = self._info_group(True); self.tgt_info = self._info_group(False)
        il.addWidget(self.src_info); il.addWidget(QLabel("  |  ")); il.addWidget(self.tgt_info); nl.addLayout(il)
        self.tab_widget.addTab(nt, "常规")
        ot = QWidget(); ol = QVBoxLayout(ot)
        t = QLabel("同步选项"); t.setStyleSheet("font-size:14px;font-weight:bold;color:#1E90FF;"); ol.addWidget(t)
        self.chk_tx = QCheckBox("使用事务"); self.chk_tx.setChecked(True); ol.addWidget(self.chk_tx)
        self.chk_dt = QCheckBox("显示详细同步信息"); self.chk_dt.setChecked(True); ol.addWidget(self.chk_dt)
        self.chk_ins = QCheckBox("插入记录"); self.chk_ins.setChecked(True); ol.addWidget(self.chk_ins)
        self.chk_del = QCheckBox("删除记录"); self.chk_del.setChecked(True); ol.addWidget(self.chk_del)
        self.chk_upd = QCheckBox("更新记录"); self.chk_upd.setChecked(True); ol.addWidget(self.chk_upd)
        ol.addStretch(); self.tab_widget.addTab(ot, "选项")
        layout.addWidget(self.tab_widget)
        bl = QHBoxLayout(); bl.addWidget(QPushButton("保存设置文件")); bl.addWidget(QPushButton("加载设置文件")); bl.addStretch()
        self._next = QPushButton("下一步 →"); self._primary_btn(self._next)
        self._next.clicked.connect(self._on_next_clicked); bl.addWidget(self._next); layout.addLayout(bl)
        self._next.setEnabled(True)
        self._log_info("下一步按钮已初始化并启用")

    def _info_group(self, is_src):
        g = QGroupBox("信息"); grid = QGridLayout(g)
        labels = ["项目名:", "连接类型:", "连接名:", "主机:", "端口:", "服务器版本:"]
        vals = []
        for i, l in enumerate(labels):
            grid.addWidget(QLabel(l), i, 0); v = QLabel("未选择"); grid.addWidget(v, i, 1); vals.append(v)
        if is_src:
            self._src_iv = vals
        else:
            self._tgt_iv = vals
        return g

    def load_source_connections(self):
        self.source_conn_combo.clear(); self.source_conn_combo.addItem("未选择")
        for n in self.main_window.saved_connections:
            self.source_conn_combo.addItem(n)
        self.source_conn_combo.currentTextChanged.connect(self._on_src_conn)
        self._log_info(f"已加载源连接列表, 共 {len(self.main_window.saved_connections)} 个连接")

    def load_target_connections(self):
        self.target_conn_combo.clear(); self.target_conn_combo.addItem("未选择")
        for n in self.main_window.saved_connections:
            self.target_conn_combo.addItem(n)
        self.target_conn_combo.currentTextChanged.connect(self._on_tgt_conn)
        self._log_info(f"已加载目标连接列表, 共 {len(self.main_window.saved_connections)} 个连接")

    def load_source_databases(self):
        self.source_db_combo.clear(); self.source_db_combo.addItem("未选择")
        c = self.source_conn_combo.currentText()
        if c and c != "未选择":
            self._async_load_dbs(self.source_db_combo, c)
        self.source_db_combo.currentTextChanged.connect(lambda: self._update_top())

    def load_target_databases(self):
        self.target_db_combo.clear(); self.target_db_combo.addItem("未选择")
        c = self.target_conn_combo.currentText()
        if c and c != "未选择":
            self._async_load_dbs(self.target_db_combo, c)
        self.target_db_combo.currentTextChanged.connect(lambda: self._update_top())

    def _async_load_dbs(self, combo, name):
        """异步加载数据库列表"""
        self._log_info(f"开始异步加载数据库列表, 连接名: {name}")
        combo.setEnabled(False)
        combo.setStyleSheet("QComboBox{color:#999;}")
        
        worker = DatabaseWorker(self.engine, 'fetch_databases', name)
        worker.finished.connect(lambda dbs, cb=combo, nm=name: self._on_load_dbs_finished(dbs, cb, nm))
        worker.error.connect(lambda err, cb=combo: self._on_load_dbs_error(err, cb))
        worker.finished.connect(worker.deleteLater)
        worker.error.connect(worker.deleteLater)
        self._workers.append(worker)
        worker.start()

    def _on_load_dbs_finished(self, dbs, combo, name):
        """数据库列表加载完成"""
        self._log_info(f"===== _on_load_dbs_finished 被调用 =====")
        self._log_info(f"数据库列表加载完成, 连接名: {name}, 数据库数量: {len(dbs) if dbs else 0}")
        self._log_info(f"combo 对象: {combo}")
        combo.clear()
        combo.addItem("未选择")
        
        if dbs:
            combo.setStyleSheet("")
            for db in dbs:
                combo.addItem(db)
        else:
            d = self.main_window.saved_connections.get(name)
            if d:
                combo.setStyleSheet("QComboBox{color:red;}")
                QTimer.singleShot(2000, lambda: combo.setStyleSheet(""))
        
        combo.setEnabled(True)
        self._update_top()
        
        # 检查是否所有连接和数据库都已选择，如果是则启用下一步按钮
        sc = self.source_conn_combo.currentText()
        sd = self.source_db_combo.currentText()
        tc = self.target_conn_combo.currentText()
        td = self.target_db_combo.currentText()
        
        can_proceed = sc != "未选择" and sd != "未选择" and tc != "未选择" and td != "未选择"
        self._log_info(f"检查下一步按钮状态: 源连接={sc}, 源数据库={sd}, 目标连接={tc}, 目标数据库={td}, 可继续={can_proceed}")
        
        if can_proceed:
            if not self._next.isEnabled():
                self._next.setEnabled(True)
                self._log_info("下一步按钮已启用")

    def _on_load_dbs_error(self, err, combo):
        """数据库列表加载失败"""
        self._log_error(f"数据库列表加载失败: {err}")
        combo.setStyleSheet("QComboBox{color:red;}")
        combo.setEnabled(True)
        QTimer.singleShot(2000, lambda: combo.setStyleSheet(""))

    def _on_src_conn(self, name):
        self._log_info(f"===== _on_src_conn 源连接变更 =====")
        self._log_info(f"源连接变更为: {name}")
        self._log_info(f"当前源数据库选择: {self.source_db_combo.currentText()}")
        self._log_info(f"当前目标连接: {self.target_conn_combo.currentText()}")
        self._log_info(f"当前目标数据库: {self.target_db_combo.currentText()}")
        
        self.source_db_combo.blockSignals(True)
        self.source_db_combo.clear()
        self.source_db_combo.addItem("未选择")
        self.source_db_combo.blockSignals(False)
        
        if name and name != "未选择":
            self._log_info(f"开始异步加载源数据库列表: {name}")
            self._async_load_dbs(self.source_db_combo, name)
        self._update_top()

    def _on_tgt_conn(self, name):
        self._log_info(f"目标连接变更: {name}")
        self.target_db_combo.blockSignals(True)
        self.target_db_combo.clear()
        self.target_db_combo.addItem("未选择")
        self.target_db_combo.blockSignals(False)
        
        if name and name != "未选择":
            self._async_load_dbs(self.target_db_combo, name)
        self._update_top()

    def _update_top(self):
        sc = self.source_conn_combo.currentText(); sd = self.source_db_combo.currentText()
        tc = self.target_conn_combo.currentText(); td = self.target_db_combo.currentText()
        
        self._log_info(f"_update_top - 源连接={sc}, 源数据库={sd}, 目标连接={tc}, 目标数据库={td}")
        
        self.src_conn_label.setText(sc if sc != "未选择" else "未选择")
        self.src_db_label.setText(sd if sd != "未选择" else "未选择")
        self.tgt_conn_label.setText(tc if tc != "未选择" else "未选择")
        self.tgt_db_label.setText(td if td != "未选择" else "未选择")
        self._rs_src_lbl.setText(f"{sc}/{sd}" if sc != "未选择" else "未选择")
        self._rs_tgt_lbl.setText(f"{tc}/{td}" if tc != "未选择" else "未选择")
        sd2 = self.main_window.saved_connections.get(sc) if sc != "未选择" else None
        td2 = self.main_window.saved_connections.get(tc) if tc != "未选择" else None
        self._upd_info(self._src_iv, sd2); self._upd_info(self._tgt_iv, td2)
        
        # 检查按钮状态
        can_proceed = sc != "未选择" and sd != "未选择" and tc != "未选择" and td != "未选择"
        current_enabled = self._next.isEnabled()
        
        self._log_info(f"_update_top - 可继续={can_proceed}, 当前按钮状态={current_enabled}, 按钮文本='{self._next.text()}'")
        
        if can_proceed and not current_enabled:
            self._next.setEnabled(True)
            self._log_info(f"_update_top: 启用下一步按钮")
            self._log_info(f"_update_top: 按钮状态已变为={self._next.isEnabled()}")
        elif not can_proceed and current_enabled:
            self._next.setEnabled(False)
            self._log_info(f"_update_top: 禁用下一步按钮")
            self._log_info(f"_update_top: 按钮状态已变为={self._next.isEnabled()}")

    def _upd_info(self, vals, data):
        vs = ["我的连接", data.get('type', ''), data.get('name', ''), data.get('host', ''), str(data.get('port', '')), ''] if data else ["未选择"] * 6
        for l, v in zip(vals, vs):
            l.setText(v)

    def _swap_source_target(self):
        self._log_info("交换源和目标连接")
        sc = self.source_conn_combo.currentText(); sd = self.source_db_combo.currentText()
        tc = self.target_conn_combo.currentText(); td = self.target_db_combo.currentText()
        self.source_conn_combo.blockSignals(True); self.target_conn_combo.blockSignals(True)
        i1 = self.source_conn_combo.findText(tc); i2 = self.target_conn_combo.findText(sc)
        if i1 >= 0:
            self.source_conn_combo.setCurrentIndex(i1)
        if i2 >= 0:
            self.target_conn_combo.setCurrentIndex(i2)
        self.source_conn_combo.blockSignals(False); self.target_conn_combo.blockSignals(False)
        self.source_db_combo.blockSignals(True); self.target_db_combo.blockSignals(True)
        i3 = self.source_db_combo.findText(td); i4 = self.target_db_combo.findText(sd)
        if i3 >= 0:
            self.source_db_combo.setCurrentIndex(i3)
        if i4 >= 0:
            self.target_db_combo.setCurrentIndex(i4)
        self.source_db_combo.blockSignals(False); self.target_db_combo.blockSignals(False)
        self._update_top()

    # ========== 页面2：表列表 ==========
    def _setup_table_list_page(self):
        self.table_list_page.setStyleSheet(self.NAV_STYLE)
        l = QVBoxLayout(self.table_list_page); l.setContentsMargins(10, 10, 10, 10)
        sf = QFrame(); sf.setStyleSheet("QFrame{background:#F5F8FA;border:1px solid #D0D0D0;border-radius:4px;padding:4px;}")
        sb = QHBoxLayout(sf); sb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._ts_src = QLabel("未选择"); self._ts_src.setStyleSheet("font-weight:bold;font-size:13px;color:#2E7D32;")
        self._ts_tgt = QLabel("未选择"); self._ts_tgt.setStyleSheet("font-weight:bold;font-size:13px;color:#1565C0;")
        sb.addWidget(QLabel("🖥 ")); sb.addWidget(self._ts_src); sb.addWidget(QLabel("  ⟹  ")); sb.addWidget(self._ts_tgt); sb.addWidget(QLabel(" 🖥"))
        l.addWidget(sf)
        ts = QHBoxLayout()
        sg = QGroupBox("源表  (勾选需要同步的表)"); sl = QVBoxLayout(sg)
        self._src_tbl = QTableWidget(); self._src_tbl.setColumnCount(1); self._src_tbl.setHorizontalHeaderLabels([""])
        self._src_tbl.horizontalHeader().setStretchLastSection(True); sl.addWidget(self._src_tbl); ts.addWidget(sg)
        tg = QGroupBox("目标表"); tl = QVBoxLayout(tg)
        self._tgt_tbl = QTableWidget(); self._tgt_tbl.setColumnCount(1); self._tgt_tbl.setHorizontalHeaderLabels([""])
        self._tgt_tbl.horizontalHeader().setStretchLastSection(True); tl.addWidget(self._tgt_tbl); ts.addWidget(tg)
        l.addLayout(ts)
        bl = QHBoxLayout(); bl.addWidget(QPushButton("保存设置文件")); bl.addStretch()
        self._prev_btn = QPushButton("← 上一步"); self._prev_btn.clicked.connect(self.show_main_page); bl.addWidget(self._prev_btn)
        self._cmp_btn = QPushButton("开始比对"); self._primary_btn(self._cmp_btn)
        self._cmp_btn.clicked.connect(self._compare_tables); bl.addWidget(self._cmp_btn); l.addLayout(bl)

    def show_main_page(self):
        self._log_info("切换到主页面")
        self.current_page = "main"; self.stacked_widget.setCurrentWidget(self.main_page)

    def _on_next_clicked(self):
        """处理下一步按钮点击事件"""
        self._log_info("===== 下一步按钮被点击 =====")
        self._log_info(f"按钮状态: enabled={self._next.isEnabled()}, text={self._next.text()}")
        
        sc = self.source_conn_combo.currentText()
        sd = self.source_db_combo.currentText()
        tc = self.target_conn_combo.currentText()
        td = self.target_db_combo.currentText()
        
        self._log_info(f"当前选择 - 源连接: {sc}, 源数据库: {sd}, 目标连接: {tc}, 目标数据库: {td}")
        
        # 检查是否所有连接和数据库都已选择
        if sc == "未选择" or sd == "未选择" or tc == "未选择" or td == "未选择":
            self._log_info("连接信息不完整，显示警告对话框")
            QMessageBox.warning(self, "提示", "请先选择源和目标连接及数据库")
            return
        
        self._log_info("连接信息完整，调用 show_table_list_page")
        self.show_table_list_page()

    def show_table_list_page(self):
        self._log_info("===== show_table_list_page 方法被调用 =====")
        
        sc = self.source_conn_combo.currentText(); sd = self.source_db_combo.currentText()
        tc = self.target_conn_combo.currentText(); td = self.target_db_combo.currentText()
        
        self._log_info(f"获取连接信息完成 - 源: {sc}/{sd}, 目标: {tc}/{td}")
        
        if sc == "未选择" or sd == "未选择" or tc == "未选择" or td == "未选择":
            self._log_error("连接信息不完整，显示提示对话框")
            QMessageBox.warning(self, "提示", "请先选择源和目标连接及数据库"); return
        
        self._log_info(f"切换到表列表页面, 源: {sc}/{sd}, 目标: {tc}/{td}")
        
        self._log_info("禁用下一步按钮，显示加载状态")
        self._next.setEnabled(False)
        self._next.setText("⏳ 加载表列表...")
        
        self._log_info("更新界面显示")
        self._update_top()
        self._ts_src.setText(f"{sc}/{sd}"); self._ts_tgt.setText(f"{tc}/{td}")
        
        self._log_info("调用 _fetch_tables_async 开始获取表列表")
        self._fetch_tables_async(sc, sd, tc, td)

    def _fetch_tables_async(self, sc, sd, tc, td):
        """异步获取表列表"""
        self._log_info(f"===== _fetch_tables_async 方法开始执行 =====")
        self._log_info(f"参数: 源: {sc}/{sd}, 目标: {tc}/{td}")
        
        def on_src_tables_finished(src_tables):
            self._log_info(f"源表列表获取完成, 数量: {len(src_tables)}")
            
            worker_tgt = DatabaseWorker(self.engine, 'fetch_tables', tc, td)
            worker_tgt.finished.connect(lambda tgt_tables: on_both_finished(src_tables, tgt_tables))
            worker_tgt.error.connect(lambda err: on_fetch_error(err))
            worker_tgt.finished.connect(worker_tgt.deleteLater)
            worker_tgt.error.connect(worker_tgt.deleteLater)
            self._workers.append(worker_tgt)
            worker_tgt.start()
        
        def on_both_finished(src_tables, tgt_tables):
            self._log_info(f"目标表列表获取完成, 数量: {len(tgt_tables)}")
            self._fill_tbl(self._src_tbl, src_tables, True)
            self._fill_tbl(self._tgt_tbl, tgt_tables, False)
            self.current_page = "table_list"
            self.stacked_widget.setCurrentWidget(self.table_list_page)
            self._next.setEnabled(True)
            self._next.setText("下一步 →")
        
        def on_fetch_error(err):
            self._log_error(f"获取表列表失败: {err}")
            QMessageBox.warning(self, "获取表列表失败", str(err))
            self._next.setEnabled(True)
            self._next.setText("下一步 →")
        
        self._log_info("创建源表工作线程")
        worker_src = DatabaseWorker(self.engine, 'fetch_tables', sc, sd)
        worker_src.finished.connect(on_src_tables_finished)
        worker_src.error.connect(on_fetch_error)
        worker_src.finished.connect(worker_src.deleteLater)
        worker_src.error.connect(worker_src.deleteLater)
        self._workers.append(worker_src)
        worker_src.start()
        
        self._log_info("源表工作线程已启动")

    def _fill_tbl(self, tw, names, checkable):
        tw.setRowCount(len(names))
        for i, n in enumerate(names):
            item = QTableWidgetItem(n)
            if checkable:
                item.setCheckState(Qt.CheckState.Checked)
            tw.setItem(i, 0, item)

    # ========== 页面3：比对结果 ==========
    def _setup_result_page(self):
        self.result_page.setStyleSheet(self.NAV_STYLE)
        outer = QVBoxLayout(self.result_page); outer.setContentsMargins(0, 0, 0, 0)

        top_bar = QFrame()
        top_bar.setStyleSheet("QFrame{background:#F0F4F8;border-bottom:1px solid #C8C8C8;padding:6px 12px;}")
        tb = QHBoxLayout(top_bar); tb.setContentsMargins(12, 4, 12, 4)
        tb.addWidget(QLabel("🖥 ")); tb.setSpacing(3)
        self._rs_src_lbl = QLabel("未选择"); self._rs_src_lbl.setStyleSheet("font-weight:bold;color:#2E7D32;font-size:13px;")
        tb.addWidget(self._rs_src_lbl); tb.addWidget(QLabel(" ⟹  "))
        self._rs_tgt_lbl = QLabel("未选择"); self._rs_tgt_lbl.setStyleSheet("font-weight:bold;color:#1565C0;font-size:13px;")
        tb.addWidget(self._rs_tgt_lbl); tb.addWidget(QLabel(" 🖥"))
        tb.addSpacing(20)
        self._chk_show_same = QCheckBox("显示相同的表和其他")
        self._chk_show_same.setChecked(True)
        self._chk_show_same.toggled.connect(self._apply_table_filter)
        tb.addWidget(self._chk_show_same); tb.addSpacing(10)
        tb.addWidget(QLabel("筛选:"))
        self._filter_input = QLineEdit()
        self._filter_input.setPlaceholderText("表名/状态过滤")
        self._filter_input.setFixedWidth(160)
        self._filter_input.textChanged.connect(self._apply_table_filter)
        tb.addWidget(self._filter_input); tb.addStretch()
        sep = QFrame(); sep.setFrameShape(QFrame.Shape.VLine); sep.setStyleSheet("color:#CCC;")
        tb.addWidget(sep); tb.addSpacing(8)
        self._stat_total = QLabel("总表:0"); self._stat_total.setStyleSheet("color:#333;font-size:12px;")
        self._stat_diff = QLabel("差异:0"); self._stat_diff.setStyleSheet("color:#E65100;font-weight:bold;font-size:12px;")
        for w in [self._stat_total, self._stat_diff]:
            tb.addWidget(w); tb.addSpacing(10)
        outer.addWidget(top_bar)

        main_splitter = QSplitter(Qt.Orientation.Vertical)

        table_area = QWidget(); ta_layout = QVBoxLayout(table_area); ta_layout.setContentsMargins(8, 4, 8, 2)
        self._table_list = QTableWidget()
        self._table_list.setColumnCount(8)
        self._table_list.setHorizontalHeaderLabels(["部署", "源表", "目标表", "插入", "更新", "删除", "相同", "信息"])
        self._table_list.setColumnWidth(0, 50); self._table_list.setColumnWidth(1, 140)
        self._table_list.setColumnWidth(2, 140); self._table_list.setColumnWidth(3, 70)
        self._table_list.setColumnWidth(4, 70); self._table_list.setColumnWidth(5, 70)
        self._table_list.setColumnWidth(6, 70); self._table_list.setColumnWidth(7, 160)
        self._table_list.verticalHeader().setVisible(False)
        self._table_list.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._table_list.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self._table_list.setSortingEnabled(True)
        self._table_list.itemSelectionChanged.connect(self._on_table_selected)
        ta_layout.addWidget(self._table_list)
        main_splitter.addWidget(table_area)

        detail_area = QWidget(); da_layout = QVBoxLayout(detail_area); da_layout.setContentsMargins(8, 2, 8, 4)
        detail_header = QHBoxLayout()
        self._detail_title_src = QLabel("请选择左侧列表中的表"); self._detail_title_src.setStyleSheet("font-weight:bold;color:#2E7D32;font-size:12px;")
        self._detail_title_tgt = QLabel(""); self._detail_title_tgt.setStyleSheet("font-weight:bold;color:#1565C0;font-size:12px;")
        detail_header.addWidget(self._detail_title_src); detail_header.addStretch()
        self._detail_count = QLabel(""); self._detail_count.setStyleSheet("color:#888;font-size:11px;")
        detail_header.addWidget(self._detail_count); detail_header.addStretch()
        detail_header.addWidget(self._detail_title_tgt)
        da_layout.addLayout(detail_header)
        dual = QHBoxLayout()
        self._detail_src = QTableWidget()
        self._detail_src.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self._detail_src.verticalHeader().setVisible(False)
        self._detail_src.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._detail_tgt = QTableWidget()
        self._detail_tgt.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self._detail_tgt.verticalHeader().setVisible(False)
        self._detail_tgt.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        dual.addWidget(self._detail_src); dual.addWidget(self._detail_tgt)
        da_layout.addLayout(dual)
        main_splitter.addWidget(detail_area)
        main_splitter.setSizes([260, 300])
        outer.addWidget(main_splitter)

        bl = QHBoxLayout(); bl.setContentsMargins(12, 4, 12, 8)
        bl.addWidget(QPushButton("保存设置文件 ▼"))
        self._back_btn = QPushButton("← 上一步")
        self._back_btn.clicked.connect(lambda: self.stacked_widget.setCurrentWidget(self.table_list_page))
        bl.addWidget(self._back_btn)
        bl.addStretch()
        self._recompare_btn = QPushButton("🔄 重新比对")
        self._recompare_btn.clicked.connect(self._compare_tables)
        bl.addWidget(self._recompare_btn)
        self._deploy_btn = QPushButton("▶ 部署同步")
        self._primary_btn(self._deploy_btn)
        self._deploy_btn.clicked.connect(self._execute_sync)
        bl.addWidget(self._deploy_btn)
        outer.addLayout(bl)

    # ========== 比对逻辑 ==========

    def _compare_tables(self):
        sc = self.source_conn_combo.currentText(); sd = self.source_db_combo.currentText()
        tc = self.target_conn_combo.currentText(); td = self.target_db_combo.currentText()
        self._log_info(f"开始表比对, 源: {sc}/{sd}, 目标: {tc}/{td}")
        
        self._deploy_btn.setEnabled(False)
        self._deploy_btn.setText("⏳ 比对中...")
        self.stacked_widget.setCurrentWidget(self.result_page)
        
        self._compare_tables_async(sc, sd, tc, td)

    def _compare_tables_async(self, sc, sd, tc, td):
        """异步执行表比对"""
        checked = set()
        for i in range(self._src_tbl.rowCount()):
            item = self._src_tbl.item(i, 0)
            if item and item.checkState() == Qt.CheckState.Checked:
                checked.add(item.text())
        
        self._log_info(f"开始异步获取源表列表: {sc}/{sd}")
        src_worker = DatabaseWorker(self.engine, 'fetch_tables', sc, sd)
        
        def on_src_tables_finished(src_all):
            self._log_info(f"源表列表获取完成: {len(src_all)} 张")
            src_set = checked if checked else set(src_all)
            
            self._log_info(f"开始异步获取目标表列表: {tc}/{td}")
            tgt_worker = DatabaseWorker(self.engine, 'fetch_tables', tc, td)
            
            def on_tgt_tables_finished(tgt_all):
                self._log_info(f"目标表列表获取完成: {len(tgt_all)} 张")
                tgt_set = set(tgt_all)
                common = sorted(src_set & tgt_set)
                
                self._log_info(f"比对表数量: {len(common)} 张")
                
                self._cache = {'sc': sc, 'sd': sd, 'tc': tc, 'td': td, 'tables': {}}
                
                compare_worker = DatabaseWorker(self.engine, 'compare_tables', sc, sd, common, tc, td)
                compare_worker.finished.connect(lambda result: self._on_compare_finished(result))
                compare_worker.error.connect(lambda err: self._on_compare_error(err))
                compare_worker.finished.connect(compare_worker.deleteLater)
                compare_worker.error.connect(compare_worker.deleteLater)
                self._workers.append(compare_worker)
                compare_worker.start()
            
            def on_tgt_tables_error(err):
                self._log_error(f"获取目标表列表失败: {err}")
                QMessageBox.critical(self, "比对失败", f"获取目标表列表失败:\n{err}")
                self._deploy_btn.setEnabled(True)
                self._deploy_btn.setText("▶ 部署同步")
            
            tgt_worker.finished.connect(on_tgt_tables_finished)
            tgt_worker.error.connect(on_tgt_tables_error)
            tgt_worker.finished.connect(tgt_worker.deleteLater)
            tgt_worker.error.connect(tgt_worker.deleteLater)
            self._workers.append(tgt_worker)
            tgt_worker.start()
        
        def on_src_tables_error(err):
            self._log_error(f"获取源表列表失败: {err}")
            QMessageBox.critical(self, "比对失败", f"获取源表列表失败:\n{err}")
            self._deploy_btn.setEnabled(True)
            self._deploy_btn.setText("▶ 部署同步")
        
        src_worker.finished.connect(on_src_tables_finished)
        src_worker.error.connect(on_src_tables_error)
        src_worker.finished.connect(src_worker.deleteLater)
        src_worker.error.connect(src_worker.deleteLater)
        self._workers.append(src_worker)
        src_worker.start()

    def _on_compare_finished(self, tables_result):
        """比对完成"""
        self._log_info(f"表比对完成, 结果表数量: {len(tables_result)}")
        self._cache['tables'] = tables_result
        self._update_table_list()
        self._update_top()
        self._deploy_btn.setEnabled(True)
        self._deploy_btn.setText("▶ 部署同步")

    def _on_compare_error(self, err):
        """比对失败"""
        self._log_error(f"表比对失败: {err}")
        QMessageBox.critical(self, "比对失败", str(err))
        self._deploy_btn.setEnabled(True)
        self._deploy_btn.setText("▶ 部署同步")

    def _update_table_list(self):
        self._table_list.setRowCount(0)
        self._table_list.setSortingEnabled(False)
        tables = self._cache.get('tables', {})
        total = len(tables)
        total_diff = sum(1 for t in tables.values() if t['insert'] + t['update'] + t['delete'] > 0 or t['info'])
        self._stat_total.setText(f"总表:{total}")
        self._stat_diff.setText(f"差异:{total_diff}")
        show_same = self._chk_show_same.isChecked()
        filter_text = self._filter_input.text().strip().lower()
        row = 0
        for tbl_name in sorted(tables.keys()):
            td = tables[tbl_name]
            has_diff = td['insert'] + td['update'] + td['delete'] > 0 or td['info']
            if not show_same and not has_diff:
                continue
            if filter_text and filter_text not in tbl_name.lower():
                continue
            self._table_list.insertRow(row)

            deploy_item = QTableWidgetItem()
            deploy_item.setFlags(Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsSelectable)
            deploy_item.setCheckState(Qt.CheckState.Checked if has_diff else Qt.CheckState.Unchecked)
            deploy_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self._table_list.setItem(row, 0, deploy_item)

            name_item = QTableWidgetItem(tbl_name)
            name_item.setData(Qt.ItemDataRole.UserRole, tbl_name)
            self._table_list.setItem(row, 1, name_item)
            self._table_list.setItem(row, 2, QTableWidgetItem(tbl_name))

            for col_idx, key in [(3, 'insert'), (4, 'update'), (5, 'delete'), (6, 'same')]:
                val = td[key]
                op_item = QTableWidgetItem(str(val))
                op_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                op_item.setFlags(Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsSelectable)
                op_item.setCheckState(Qt.CheckState.Checked if val > 0 else Qt.CheckState.Unchecked)
                if val > 0:
                    op_item.setForeground(QColor("#E65100"))
                    op_item.setFont(QFont("", 10, QFont.Weight.Bold))
                self._table_list.setItem(row, col_idx, op_item)

            info_item = QTableWidgetItem(td['info'] if td['info'] else "")
            if td['info']:
                info_item.setForeground(QColor("#C62828"))
            self._table_list.setItem(row, 7, info_item)
            row += 1
        self._table_list.setSortingEnabled(True)

    def _apply_table_filter(self):
        self._update_table_list()

    def _on_table_selected(self):
        rows = self._table_list.selectedItems()
        if not rows:
            return
        tbl_name = self._table_list.item(rows[0].row(), 1).data(Qt.ItemDataRole.UserRole)
        if not tbl_name:
            tbl_name = rows[0].text()
        if tbl_name == self._selected_table:
            return
        self._selected_table = tbl_name
        self._load_row_detail(tbl_name)

    def _load_row_detail(self, tbl_name):
        td = self._cache.get('tables', {}).get(tbl_name)
        if not td:
            return
        src_cols = td['src_columns']; tgt_cols = td['tgt_columns']
        pk_name = td['pk_name']; diff_rows = td['diff_rows']
        self._detail_title_src.setText(f"源库 - {tbl_name}")
        self._detail_title_tgt.setText(f"目标库 - {tbl_name}")
        self._detail_count.setText(f"插入{td['insert']}  更新{td['update']}  删除{td['delete']}  相同{td['same']}")
        type_order = {'delete': 0, 'update': 1, 'insert': 2}
        diff_rows.sort(key=lambda r: (type_order.get(r['type'], 9), r['pk']))
        all_cols = list(src_cols)
        self._detail_src.setColumnCount(len(all_cols))
        self._detail_src.setHorizontalHeaderLabels(all_cols)
        self._detail_src.setRowCount(len(diff_rows))
        self._detail_tgt.setColumnCount(len(tgt_cols))
        self._detail_tgt.setHorizontalHeaderLabels(tgt_cols)
        self._detail_tgt.setRowCount(len(diff_rows))
        self._detail_src.verticalHeader().setDefaultSectionSize(24)
        self._detail_tgt.verticalHeader().setDefaultSectionSize(24)
        highlight_bg = QBrush(QColor("#FFF3E0"))
        insert_bg = QBrush(QColor("#E8F5E9"))
        delete_bg = QBrush(QColor("#FFEBEE"))
        gray_fg = QColor("#AAAAAA")
        for i, dr in enumerate(diff_rows):
            dtype = dr['type']
            row_bg_src = insert_bg if dtype == 'insert' else (delete_bg if dtype == 'delete' else None)
            row_bg_tgt = row_bg_src
            srow = dr.get('src')
            for j, col in enumerate(all_cols):
                val = str(srow.get(col, '')) if srow else ""
                item = QTableWidgetItem(val)
                if row_bg_src:
                    item.setBackground(row_bg_src)
                changed = dr.get('changed', {})
                if dtype == 'update' and col in changed:
                    item.setBackground(highlight_bg)
                if dtype == 'delete':
                    item.setForeground(gray_fg)
                self._detail_src.setItem(i, j, item)
            trow = dr.get('tgt')
            for j, col in enumerate(tgt_cols):
                val = str(trow.get(col, '')) if trow else ""
                item = QTableWidgetItem(val)
                if row_bg_tgt:
                    item.setBackground(row_bg_tgt)
                changed = dr.get('changed', {})
                if dtype == 'update' and col in changed:
                    item.setBackground(highlight_bg)
                if dtype == 'insert':
                    item.setForeground(gray_fg)
                self._detail_tgt.setItem(i, j, item)
        if all_cols:
            col_idx = 0
            if pk_name in all_cols:
                col_idx = all_cols.index(pk_name)
            self._detail_src.setColumnWidth(col_idx, 80)
        self._detail_src.resizeColumnsToContents()
        self._detail_tgt.resizeColumnsToContents()
        for j in range(min(self._detail_src.columnCount(), self._detail_tgt.columnCount())):
            w = max(self._detail_src.columnWidth(j), self._detail_tgt.columnWidth(j))
            w = min(w, 250)
            self._detail_src.setColumnWidth(j, w)
            if j < self._detail_tgt.columnCount():
                self._detail_tgt.setColumnWidth(j, w)

    # ========== 页面4：SQL预览确认 ==========

    def _setup_sql_preview_page(self):
        self.sql_preview_page.setStyleSheet(self.NAV_STYLE)
        outer = QVBoxLayout(self.sql_preview_page); outer.setContentsMargins(0, 0, 0, 0)

        top_bar = QFrame()
        top_bar.setStyleSheet("QFrame{background:#F0F4F8;border-bottom:1px solid #C8C8C8;padding:6px 12px;}")
        tb = QHBoxLayout(top_bar); tb.setContentsMargins(12, 4, 12, 4)
        tb.addWidget(QLabel("🖥 ")); tb.setSpacing(3)
        self._pv_src_lbl = QLabel("未选择"); self._pv_src_lbl.setStyleSheet("font-weight:bold;color:#2E7D32;font-size:13px;")
        tb.addWidget(self._pv_src_lbl); tb.addWidget(QLabel(" ⟹  "))
        self._pv_tgt_lbl = QLabel("未选择"); self._pv_tgt_lbl.setStyleSheet("font-weight:bold;color:#1565C0;font-size:13px;")
        tb.addWidget(self._pv_tgt_lbl); tb.addWidget(QLabel(" 🖥"))
        tb.addSpacing(20)
        self._pv_summary = QLabel(""); self._pv_summary.setStyleSheet("color:#555;font-size:12px;")
        tb.addWidget(self._pv_summary)
        tb.addStretch()
        outer.addWidget(top_bar)

        sql_area_container = QWidget()
        sa_layout = QVBoxLayout(sql_area_container); sa_layout.setContentsMargins(10, 6, 10, 6)
        sa_layout.addWidget(QLabel("即将执行的SQL语句（请仔细核对）："))
        self._sql_editor = QTextEdit()
        self._sql_editor.setReadOnly(True)
        self._sql_editor.setFont(QFont("Consolas", 11))
        self._sql_editor.setStyleSheet(
            "QTextEdit{border:1px solid #C0C0C0;border-radius:3px;background:#FAFAFA;padding:8px;}")
        self._sql_editor.setPlaceholderText("暂无SQL语句...")
        sa_layout.addWidget(self._sql_editor)
        outer.addWidget(sql_area_container)

        bl = QHBoxLayout(); bl.setContentsMargins(12, 4, 12, 8)
        self._pv_back_btn = QPushButton("← 返回比对结果")
        self._pv_back_btn.clicked.connect(self._back_to_result)
        bl.addWidget(self._pv_back_btn)
        bl.addStretch()
        self._pv_execute_btn = QPushButton("▶ 确认执行")
        self._primary_btn(self._pv_execute_btn)
        self._pv_execute_btn.clicked.connect(self._confirm_execute)
        bl.addWidget(self._pv_execute_btn)
        outer.addLayout(bl)

    def _back_to_result(self):
        self._log_info("返回比对结果页面")
        self._deploy_btn.setEnabled(True)
        self._deploy_btn.setText("▶ 部署同步")
        self.stacked_widget.setCurrentWidget(self.result_page)

    # ========== 执行同步（按勾选过滤+SQL预览确认） ==========

    def _filter_selected_tables(self):
        op_map = {3: 'insert', 4: 'update', 5: 'delete'}
        filtered = {}
        total_tables = 0
        for row in range(self._table_list.rowCount()):
            deploy_item = self._table_list.item(row, 0)
            if not deploy_item or deploy_item.checkState() != Qt.CheckState.Checked:
                continue
            tbl_name = self._table_list.item(row, 1).data(Qt.ItemDataRole.UserRole)
            if not tbl_name:
                continue
            td = self._cache['tables'].get(tbl_name)
            if not td:
                continue
            allowed_types = set()
            for col, op_type in op_map.items():
                item = self._table_list.item(row, col)
                if item and item.checkState() == Qt.CheckState.Checked:
                    allowed_types.add(op_type)
            if not allowed_types:
                continue
            filtered_rows = [dr for dr in td['diff_rows'] if dr['type'] in allowed_types]
            if not filtered_rows:
                continue
            filtered[tbl_name] = dict(td, diff_rows=filtered_rows)
            total_tables += 1
        return filtered, total_tables

    def _build_sql_text(self, filtered):
        lines = []
        tc, td = self._cache['tc'], self._cache['td']
        lines.append(f"-- ===== 数据同步SQL脚本 =====")
        lines.append(f"-- 目标: {tc}/{td}")
        lines.append(f"-- 生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"-- 表数量: {len(filtered)}")
        lines.append("")

        for tbl_name, info in filtered.items():
            pk_name = info['pk_name']
            src_cols = info['src_columns']
            tgt_col_info = info.get('tgt_col_info', {})
            diff_rows = info['diff_rows']
            lines.append(f"-- ======== {tbl_name} ========")

            type_order = {'delete': 0, 'update': 1, 'insert': 2}
            diff_rows.sort(key=lambda r: (type_order.get(r['type'], 9), r['pk']))

            def trunc(val, col_name):
                if tgt_col_info:
                    ml = tgt_col_info.get(col_name, {}).get('max_length')
                    if ml is not None and isinstance(val, str):
                        enc = val.encode('utf-8')
                        if len(enc) > ml:
                            while len(val.encode('utf-8')) > ml:
                                val = val[:-1]
                return val

            for dr in diff_rows:
                dtype = dr['type']
                pk_val = dr['pk']

                if dtype == 'delete':
                    if not info['pk_cols']:
                        lines.append(f"-- DELETE FROM `{tbl_name}` (无主键，跳过)")
                        continue
                    lines.append(f"DELETE FROM `{tbl_name}` WHERE `{pk_name}` = '{pk_val}';")

                elif dtype == 'update':
                    changed = dr.get('changed', {})
                    if not changed:
                        continue
                    if not info['pk_cols']:
                        lines.append(f"-- UPDATE `{tbl_name}` (无主键，跳过)")
                        continue
                    parts = []
                    for col in changed:
                        val = trunc(changed[col]['src'], col)
                        escaped = str(val).replace(chr(39), chr(39)+chr(39))
                        parts.append(f"`{col}` = '{escaped}'")
                    lines.append(f"UPDATE `{tbl_name}` SET {', '.join(parts)} WHERE `{pk_name}` = '{pk_val}';")

                elif dtype == 'insert':
                    srow = dr['src']
                    if not srow:
                        continue
                    cols_list = [col for col in src_cols if col in srow]
                    vals_list = []
                    for col in cols_list:
                        val = trunc(srow[col], col)
                        escaped = str(val).replace(chr(39), chr(39)+chr(39))
                        vals_list.append(f"'{escaped}'")
                    if not cols_list:
                        continue
                    lines.append(f"INSERT INTO `{tbl_name}` ({', '.join(f'`{col}`' for col in cols_list)}) VALUES ({', '.join(vals_list)});")

            lines.append("")

        return "\n".join(lines)

    def _execute_sync(self):
        if not self._cache.get('tables'):
            QMessageBox.warning(self, "部署同步", "请先执行比对"); return

        filtered, total_tables = self._filter_selected_tables()

        if not filtered:
            QMessageBox.warning(self, "部署同步", "请勾选至少一个表和至少一种操作类型")
            return

        sc = self._cache['sc']; sd = self._cache['sd']
        tc = self._cache['tc']; td = self._cache['td']

        self._log_info(f"准备执行同步, 源: {sc}/{sd}, 目标: {tc}/{td}, 表数量: {total_tables}")

        self._pv_src_lbl.setText(f"{sc}/{sd}" if sc != "未选择" else "未选择")
        self._pv_tgt_lbl.setText(f"{tc}/{td}" if tc != "未选择" else "未选择")
        self._pv_summary.setText(f"共 {total_tables} 张表待同步")

        sql_text = self._build_sql_text(filtered)
        self._sql_editor.setPlainText(sql_text)
        self._sql_editor.moveCursor(QTextCursor.MoveOperation.Start)

        self._filtered_cache = filtered
        self._pv_execute_btn.setEnabled(True)
        self._pv_execute_btn.setText("▶ 确认执行")

        self.stacked_widget.setCurrentWidget(self.sql_preview_page)

    def _confirm_execute(self):
        if not hasattr(self, '_filtered_cache') or not self._filtered_cache:
            return

        sc = self._cache['sc']; sd = self._cache['sd']
        tc = self._cache['tc']; td = self._cache['td']
        filtered = self._filtered_cache

        if QMessageBox.question(self, "确认执行",
                f"确定对 {len(filtered)} 张表执行数据同步吗？\n"
                f"源: {sc}/{sd}\n"
                f"目标: {tc}/{td}\n\n"
                f"此操作将修改目标数据库的数据，且不可撤销！",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No) == QMessageBox.StandardButton.No:
            return

        self._log_info(f"用户确认执行同步, 目标: {tc}/{td}, 表数量: {len(filtered)}")
        
        self._pv_execute_btn.setEnabled(False)
        self._pv_execute_btn.setText("⏳ 执行中...")

        self._execute_sync_async(tc, td, filtered)

    def _execute_sync_async(self, tc, td, filtered):
        """异步执行同步操作"""
        self._log_info(f"启动同步工作线程, 目标: {tc}/{td}, 表数量: {len(filtered)}")
        
        worker = DatabaseSyncWorker(self.engine, tc, td, filtered)
        worker.progress.connect(self._on_sync_progress)
        worker.finished.connect(self._on_sync_finished)
        worker.finished.connect(worker.deleteLater)
        self._workers.append(worker)
        worker.start()

    def _on_sync_progress(self, message, current, total):
        """同步进度更新"""
        self._log_info(f"同步进度: {message}")
        self._pv_execute_btn.setText(f"⏳ {message}")
        QApplication.processEvents()

    def _on_sync_finished(self, success, msg):
        """同步完成"""
        if success:
            self._log_info(f"同步成功完成: {msg}")
        else:
            self._log_error(f"同步失败: {msg}")
        
        self._pv_execute_btn.setEnabled(True)
        self._pv_execute_btn.setText("▶ 确认执行")
        
        if success:
            QMessageBox.information(self, "部署同步", msg)
            QTimer.singleShot(500, self._compare_tables)
        else:
            QMessageBox.critical(self, "部署失败", msg)

    def closeEvent(self, event):
        """关闭对话框时清理工作线程"""
        self._log_info("DatabaseSync 对话框关闭, 清理工作线程")
        for worker in self._workers:
            if worker.isRunning():
                worker.stop()
        event.accept()
