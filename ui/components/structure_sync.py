#!/usr/bin/env python3
"""
结构同步模块 - 比对并同步数据库表结构差异
"""

from PyQt6.QtWidgets import (QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QWidget,
                            QLabel, QComboBox, QTreeWidget, QTreeWidgetItem,
                            QMessageBox, QSplitter, QTextEdit, QFrame, QCheckBox,
                            QHeaderView)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QFont, QColor, QBrush

from core.sync_engine import SyncEngine

class StructureSync(QDialog):
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.logger = main_window.logger
        self.engine = SyncEngine(main_window)

        self.setWindowTitle("结构同步")
        self.resize(1100, 720)

        self._result = None
        self.setup_ui()
        self.load_connections()

    def setup_ui(self):
        layout = QVBoxLayout(self); layout.setContentsMargins(10, 10, 10, 10)

        top = QFrame(); top.setStyleSheet("QFrame{background:#F5F8FA;border:1px solid #D0D0D0;border-radius:4px;padding:8px;}")
        tl = QHBoxLayout(top); tl.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._src_lbl = QLabel("未选择"); self._src_lbl.setStyleSheet("font-weight:bold;color:#2E7D32;font-size:13px;")
        self._tgt_lbl = QLabel("未选择"); self._tgt_lbl.setStyleSheet("font-weight:bold;color:#1565C0;font-size:13px;")
        tl.addWidget(QLabel("🖥 ")); tl.addWidget(self._src_lbl); tl.addWidget(QLabel(" ⟹ "))
        tl.addWidget(self._tgt_lbl); tl.addWidget(QLabel(" 🖥"))
        layout.addWidget(top)

        sel = QHBoxLayout()
        sg = QWidget(); sgl = QVBoxLayout(sg)
        sgl.addWidget(QLabel("源连接:"))
        self.src_conn = QComboBox(); sgl.addWidget(self.src_conn)
        sgl.addWidget(QLabel("源数据库:"))
        self.src_db = QComboBox(); sgl.addWidget(self.src_db)
        sel.addWidget(sg)
        mid = QVBoxLayout()
        self._swap_btn = QPushButton("⇄"); self._swap_btn.setFixedSize(36, 36)
        self._swap_btn.clicked.connect(self._swap)
        mid.addWidget(self._swap_btn); mid.addStretch()
        sel.addLayout(mid)
        tg = QWidget(); tgl = QVBoxLayout(tg)
        tgl.addWidget(QLabel("目标连接:"))
        self.tgt_conn = QComboBox(); tgl.addWidget(self.tgt_conn)
        tgl.addWidget(QLabel("目标数据库:"))
        self.tgt_db = QComboBox(); tgl.addWidget(self.tgt_db)
        sel.addWidget(tg)
        layout.addLayout(sel)

        self._compare_btn = QPushButton("开始比对")
        self._compare_btn.setStyleSheet("QPushButton{padding:6px 24px;background:#007ACC;color:white;border-radius:3px;}"
                                         "QPushButton:hover{background:#005FA0;}"
                                         "QPushButton:disabled{background:#CCC;color:#888;}")
        self._compare_btn.clicked.connect(self._do_compare)
        layout.addWidget(self._compare_btn, alignment=Qt.AlignmentFlag.AlignCenter)

        splitter = QSplitter(Qt.Orientation.Vertical)

        self._tree = QTreeWidget()
        self._tree.setHeaderLabels(["表名", "状态", "详情"])
        self._tree.setAlternatingRowColors(True)
        self._tree.setColumnWidth(0, 250); self._tree.setColumnWidth(1, 80)
        self._tree.header().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        splitter.addWidget(self._tree)

        self._sql_area = QTextEdit()
        self._sql_area.setReadOnly(True)
        self._sql_area.setPlaceholderText("生成的同步SQL将显示在这里...")
        self._sql_area.setFont(QFont("Consolas", 11))
        splitter.addWidget(self._sql_area)
        splitter.setSizes([350, 250])
        layout.addWidget(splitter)

        btns = QHBoxLayout()
        
        self._select_all_btn = QPushButton("全选")
        self._select_all_btn.clicked.connect(self._select_all)
        self._select_all_btn.setEnabled(False)
        btns.addWidget(self._select_all_btn)
        
        self._select_none_btn = QPushButton("全不选")
        self._select_none_btn.clicked.connect(self._select_none)
        self._select_none_btn.setEnabled(False)
        btns.addWidget(self._select_none_btn)
        
        btns.addStretch()

        self._gen_sql_btn = QPushButton("生成同步SQL")
        self._gen_sql_btn.clicked.connect(self._gen_sql)
        self._gen_sql_btn.setEnabled(False)
        btns.addWidget(self._gen_sql_btn)

        self._exec_btn = QPushButton("▶ 执行同步")
        self._exec_btn.setStyleSheet("QPushButton{padding:6px 24px;background:#007ACC;color:white;border-radius:3px;}"
                                      "QPushButton:hover{background:#005FA0;}"
                                      "QPushButton:disabled{background:#CCC;color:#888;}")
        self._exec_btn.clicked.connect(self._execute)
        self._exec_btn.setEnabled(False)
        btns.addWidget(self._exec_btn)
        btns.addStretch()
        layout.addLayout(btns)

        self.src_conn.currentTextChanged.connect(lambda t: self._on_conn(t, self.src_db))
        self.tgt_conn.currentTextChanged.connect(lambda t: self._on_conn(t, self.tgt_db))

    def load_connections(self):
        self.src_conn.addItem("未选择")
        self.tgt_conn.addItem("未选择")
        for n in self.main_window.saved_connections:
            self.src_conn.addItem(n)
            self.tgt_conn.addItem(n)
        self.src_db.addItem("未选择")
        self.tgt_db.addItem("未选择")

    def _on_conn(self, name, db_combo):
        db_combo.clear()
        db_combo.addItem("未选择")
        if not name or name == "未选择":
            return
        dbs = self.engine.fetch_databases(name)
        for db in dbs:
            db_combo.addItem(db)

    def _swap(self):
        sc = self.src_conn.currentText(); sd = self.src_db.currentText()
        tc = self.tgt_conn.currentText(); td = self.tgt_db.currentText()
        i1 = self.src_conn.findText(tc); i2 = self.tgt_conn.findText(sc)
        if i1 >= 0:
            self.src_conn.setCurrentIndex(i1)
        if i2 >= 0:
            self.tgt_conn.setCurrentIndex(i2)
        i3 = self.src_db.findText(td); i4 = self.tgt_db.findText(sd)
        if i3 >= 0:
            self.src_db.setCurrentIndex(i3)
        if i4 >= 0:
            self.tgt_db.setCurrentIndex(i4)

    def _do_compare(self):
        sc = self.src_conn.currentText(); sd = self.src_db.currentText()
        tc = self.tgt_conn.currentText(); td = self.tgt_db.currentText()
        if not sc or sc == "未选择" or not sd or sd == "未选择" or not tc or tc == "未选择" or not td or td == "未选择":
            QMessageBox.warning(self, "提示", "请选择完整的源和目标连接及数据库")
            return

        self._compare_btn.setEnabled(False)
        self._compare_btn.setText("⏳ 比对中...")
        self._tree.clear()
        self._sql_area.clear()
        self._gen_sql_btn.setEnabled(False)
        self._exec_btn.setEnabled(False)
        self._select_all_btn.setEnabled(False)
        self._select_none_btn.setEnabled(False)

        def run():
            self._result = self.engine.compare_structures(sc, sd, tc, td)
            self._display_result()
            self._compare_btn.setEnabled(True)
            self._compare_btn.setText("开始比对")

        self._src_lbl.setText(f"{sc}/{sd}")
        self._tgt_lbl.setText(f"{tc}/{td}")
        QTimer.singleShot(50, run)

    def _display_result(self):
        self._tree.clear()
        r = self._result
        if not r:
            return

        def add_group(parent, text, items, color=None, icon=None, checkable=True):
            group = QTreeWidgetItem(parent or self._tree, [text, f"{len(items)}个", ""])
            if color:
                group.setForeground(0, QColor(color))
            
            if checkable and len(items) > 0:
                group.setFlags(group.flags() | Qt.ItemFlag.ItemIsUserCheckable)
                group.setCheckState(0, Qt.CheckState.Checked)
                group.setExpanded(True)
                
                def on_group_check(state, grp, child_items):
                    for child in child_items:
                        child.setCheckState(0, state)
                
                child_items = []
                for item_name in items:
                    child = QTreeWidgetItem(group, [item_name, "", ""])
                    child.setFlags(child.flags() | Qt.ItemFlag.ItemIsUserCheckable)
                    child.setCheckState(0, Qt.CheckState.Checked)
                    if color:
                        child.setForeground(0, QColor(color))
                    child_items.append(child)
                
                group.treeWidget().itemChanged.connect(
                    lambda item, col: on_group_check(item.checkState(0), group, child_items) 
                    if item == group and col == 0 else None
                )
            else:
                group.setExpanded(True)
                for item_name in items:
                    child = QTreeWidgetItem(group, [item_name, "", ""])
                    if color:
                        child.setForeground(0, QColor(color))
            return group

        if r['only_in_source']:
            add_group(None, "仅源库存在的表（需创建）", r['only_in_source'], "#2E7D32")
        if r['only_in_target']:
            add_group(None, "仅目标库存在的表（需删除）", r['only_in_target'], "#C62828")
        if r['different']:
            add_group(None, "结构不一致的表（需修改）", r['different'], "#E65100")
        if r['same']:
            add_group(None, "结构一致的表", r['same'], "#888", checkable=False)
        if not (r['only_in_source'] or r['only_in_target'] or r['different']):
            item = QTreeWidgetItem(self._tree, ["两个数据库结构完全一致", "", ""])
            item.setForeground(0, QColor("#2E7D32"))

        has_diff = len(r['only_in_source']) > 0 or len(r['only_in_target']) > 0 or len(r['different']) > 0
        self._gen_sql_btn.setEnabled(has_diff)
        self._exec_btn.setEnabled(has_diff)
        self._select_all_btn.setEnabled(has_diff)
        self._select_none_btn.setEnabled(has_diff)

    def _select_all(self):
        for i in range(self._tree.topLevelItemCount()):
            group = self._tree.topLevelItem(i)
            if group.flags() & Qt.ItemFlag.ItemIsUserCheckable:
                group.setCheckState(0, Qt.CheckState.Checked)

    def _select_none(self):
        for i in range(self._tree.topLevelItemCount()):
            group = self._tree.topLevelItem(i)
            if group.flags() & Qt.ItemFlag.ItemIsUserCheckable:
                group.setCheckState(0, Qt.CheckState.Unchecked)

    def _get_selected_tables(self):
        selected = {
            'only_in_source': [],
            'only_in_target': [],
            'different': []
        }
        
        for i in range(self._tree.topLevelItemCount()):
            group = self._tree.topLevelItem(i)
            group_name = group.text(0)
            
            for j in range(group.childCount()):
                child = group.child(j)
                if child.checkState(0) == Qt.CheckState.Checked:
                    table_name = child.text(0)
                    
                    if "仅源库存在" in group_name:
                        selected['only_in_source'].append(table_name)
                    elif "仅目标库存在" in group_name:
                        selected['only_in_target'].append(table_name)
                    elif "结构不一致" in group_name:
                        selected['different'].append(table_name)
        
        return selected

    def _gen_sql(self):
        if not self._result:
            return
        
        selected = self._get_selected_tables()
        
        if not selected['only_in_source'] and not selected['only_in_target'] and not selected['different']:
            QMessageBox.warning(self, "提示", "请至少选择一个表")
            return
        
        sc = self.src_conn.currentText(); sd = self.src_db.currentText()
        tc = self.tgt_conn.currentText(); td = self.tgt_db.currentText()
        
        sqls = self.engine.generate_structure_sql(
            self._result, sc, sd, tc, td,
            selected_tables=selected
        )
        self._sql_area.setPlainText("\n".join(sqls) if sqls else "-- 无需同步")

    def _execute(self):
        sql_text = self._sql_area.toPlainText().strip()
        if not sql_text or sql_text.startswith("--"):
            QMessageBox.warning(self, "提示", "请先生成同步SQL")
            return

        tc = self.tgt_conn.currentText(); td = self.tgt_db.currentText()
        if QMessageBox.question(self, "确认执行",
                "确定执行结构同步吗？\n此操作将修改目标数据库的结构。",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No) == QMessageBox.StandardButton.No:
            return

        statements = [s.strip() for s in sql_text.split("\n") if s.strip() and not s.startswith("--")]

        def on_done(success, msg):
            if success:
                QMessageBox.information(self, "结构同步", msg)
                self._do_compare()
            else:
                QMessageBox.critical(self, "执行失败", msg)

        self.engine.execute_sql(tc, td, statements, on_done=on_done)
