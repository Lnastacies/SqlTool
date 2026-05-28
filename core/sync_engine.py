#!/usr/bin/env python3
"""
同步引擎 - 统一的数据同步/传输/结构比对核心层
"""

import re
import traceback
from PyQt6.QtCore import QTimer

from utils.thread_monitor import track_operation

class SyncEngine:
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
        self.pool = main_window.connection_pool
        self.saved = main_window.saved_connections
        self._log_info("SyncEngine 初始化完成")

    def _log_info(self, message):
        """记录信息日志"""
        if self.logger:
            self.logger.log('INFO', f"[SyncEngine] {message}")

    def _log_error(self, message):
        """记录错误日志"""
        if self.logger:
            self.logger.log('ERROR', f"[SyncEngine] {message}")

    # ──────────── 连接/元数据获取 ────────────

    def _get_conn(self, conn_name):
        """获取数据库连接"""
        d = self.saved.get(conn_name)
        if not d:
            self._log_error(f"无法获取连接配置: {conn_name}")
            return None, None
        c = self.pool.get_connection(conn_name, d)
        return c, d['type'] if c else None

    def _exec(self, conn, db_type, sql, params=None):
        """执行SQL语句"""
        try:
            if db_type in ('MySQL', 'MariaDB', 'PostgreSQL'):
                with conn.cursor() as cur:
                    if params:
                        cur.execute(sql, params)
                    else:
                        cur.execute(sql)
                    return cur.fetchall()
            cur = conn.cursor()
            if params:
                cur.execute(sql, params)
            else:
                cur.execute(sql)
            r = cur.fetchall()
            cur.close()
            return r
        except Exception as e:
            self._log_error(f"SQL执行失败: {sql[:50]}... 错误: {e}")
            raise

    @track_operation('SyncEngine.fetch_databases')
    def fetch_databases(self, conn_name):
        """获取数据库列表"""
        self._log_info(f"开始获取数据库列表: {conn_name}")
        d = self.saved.get(conn_name)
        if not d:
            self._log_error(f"连接配置不存在: {conn_name}")
            return []
        c, t = self._get_conn(conn_name)
        if not c:
            self._log_error(f"无法建立连接: {conn_name}")
            return []
        try:
            if t in ('MySQL', 'MariaDB'):
                with c.cursor() as cur:
                    cur.execute("SHOW DATABASES")
                    dbs = []
                    for db in cur.fetchall():
                        n = db['Database'] if isinstance(db, dict) else db[0]
                        if n not in ('information_schema','performance_schema','mysql','sys'):
                            dbs.append(n)
                    self._log_info(f"成功获取MySQL数据库列表: {conn_name}, 数量: {len(dbs)}")
                    return dbs
            elif t == 'PostgreSQL':
                with c.cursor() as cur:
                    cur.execute("SELECT datname FROM pg_database WHERE datistemplate=false")
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"成功获取PostgreSQL数据库列表: {conn_name}, 数量: {len(result)}")
                    return result
            elif t == 'SQL Server':
                with c.cursor() as cur:
                    cur.execute("SELECT name FROM sys.databases")
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"成功获取SQL Server数据库列表: {conn_name}, 数量: {len(result)}")
                    return result
        except Exception as e:
            self._log_error(f"获取数据库列表失败 [{conn_name}]: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            return []
        finally:
            self.pool.release_connection(conn_name)

    @track_operation('SyncEngine.fetch_tables')
    def fetch_tables(self, conn_name, db_name):
        """获取表列表"""
        self._log_info(f"开始获取表列表: {conn_name}/{db_name}")
        c, t = self._get_conn(conn_name)
        if not c:
            self._log_error(f"无法建立连接: {conn_name}")
            return []
        try:
            if t in ('MySQL', 'MariaDB'):
                with c.cursor() as cur:
                    cur.execute(f"USE `{db_name}`")
                    cur.execute("SHOW TABLES")
                    result = [list(r.values())[0] if isinstance(r, dict) else r[0] for r in cur.fetchall()]
                    self._log_info(f"成功获取MySQL表列表: {conn_name}/{db_name}, 数量: {len(result)}")
                    return result
            elif t == 'PostgreSQL':
                with c.cursor() as cur:
                    cur.execute("SELECT table_name FROM information_schema.tables "
                                "WHERE table_schema='public' AND table_catalog=%s", (db_name,))
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"成功获取PostgreSQL表列表: {conn_name}/{db_name}, 数量: {len(result)}")
                    return result
            elif t == 'SQL Server':
                with c.cursor() as cur:
                    cur.execute(f"USE [{db_name}]; SELECT name FROM sys.tables")
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"成功获取SQL Server表列表: {conn_name}/{db_name}, 数量: {len(result)}")
                    return result
        except Exception as e:
            self._log_error(f"获取表列表失败 [{conn_name}/{db_name}]: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            return []
        finally:
            self.pool.release_connection(conn_name)

    def get_primary_keys(self, conn_name, db_name, table_name):
        """获取主键"""
        self._log_info(f"获取主键: {conn_name}/{db_name}/{table_name}")
        c, t = self._get_conn(conn_name)
        if not c:
            self._log_error(f"无法建立连接: {conn_name}")
            return []
        try:
            if t in ('MySQL', 'MariaDB'):
                with c.cursor() as cur:
                    cur.execute(f"USE `{db_name}`")
                    cur.execute(f"SHOW KEYS FROM `{table_name}` WHERE Key_name='PRIMARY'")
                    rows = cur.fetchall()
                    cols = []
                    seen = set()
                    for r in rows:
                        col = r['Column_name'] if isinstance(r, dict) else r[4]
                        seq = r['Seq_in_index'] if isinstance(r, dict) else r[3]
                        if col not in seen:
                            seen.add(col)
                            cols.append((col, int(seq)))
                    cols.sort(key=lambda x: x[1])
                    result = [col[0] for col in cols]
                    self._log_info(f"获取主键成功: {conn_name}/{db_name}/{table_name}, 主键: {result}")
                    return result
            elif t == 'PostgreSQL':
                with c.cursor() as cur:
                    cur.execute("""
                        SELECT a.attname
                        FROM pg_index i
                        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                        WHERE i.indrelid = %s::regclass AND i.indisprimary
                        ORDER BY i.indkey
                    """, (table_name,))
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"获取主键成功: {conn_name}/{db_name}/{table_name}, 主键: {result}")
                    return result
            elif t == 'SQL Server':
                with c.cursor() as cur:
                    cur.execute(f"""
                        USE [{db_name}];
                        SELECT col.name
                        FROM sys.indexes idx
                        JOIN sys.index_columns ic ON idx.object_id = ic.object_id AND idx.index_id = ic.index_id
                        JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
                        WHERE idx.object_id = OBJECT_ID('{table_name}') AND idx.is_primary_key = 1
                        ORDER BY ic.key_ordinal
                    """)
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"获取主键成功: {conn_name}/{db_name}/{table_name}, 主键: {result}")
                    return result
            return []
        except Exception as e:
            self._log_error(f"获取主键失败 [{conn_name}/{db_name}/{table_name}]: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            return []
        finally:
            self.pool.release_connection(conn_name)

    def get_column_names(self, conn_name, db_name, table_name):
        """获取列名"""
        self._log_info(f"获取列名: {conn_name}/{db_name}/{table_name}")
        c, t = self._get_conn(conn_name)
        if not c:
            self._log_error(f"无法建立连接: {conn_name}")
            return []
        try:
            if t in ('MySQL', 'MariaDB'):
                with c.cursor() as cur:
                    cur.execute(f"USE `{db_name}`")
                    cur.execute(f"DESCRIBE `{table_name}`")
                    result = [r['Field'] if isinstance(r, dict) else r[0] for r in cur.fetchall()]
                    self._log_info(f"获取列名成功: {conn_name}/{db_name}/{table_name}, 列数: {len(result)}")
                    return result
            elif t == 'PostgreSQL':
                with c.cursor() as cur:
                    cur.execute("""
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_schema='public' AND table_name=%s
                        ORDER BY ordinal_position
                    """, (table_name,))
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"获取列名成功: {conn_name}/{db_name}/{table_name}, 列数: {len(result)}")
                    return result
            elif t == 'SQL Server':
                with c.cursor() as cur:
                    cur.execute(f"""
                        USE [{db_name}];
                        SELECT name FROM sys.columns 
                        WHERE object_id = OBJECT_ID('{table_name}')
                        ORDER BY column_id
                    """)
                    result = [r[0] for r in cur.fetchall()]
                    self._log_info(f"获取列名成功: {conn_name}/{db_name}/{table_name}, 列数: {len(result)}")
                    return result
            return []
        except Exception as e:
            self._log_error(f"获取列名失败 [{conn_name}/{db_name}/{table_name}]: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            return []
        finally:
            self.pool.release_connection(conn_name)

    def get_column_info(self, conn_name, db_name, table_name):
        """获取列信息"""
        self._log_info(f"获取列信息: {conn_name}/{db_name}/{table_name}")
        c, t = self._get_conn(conn_name)
        if not c:
            self._log_error(f"无法建立连接: {conn_name}")
            return {}
        try:
            if t in ('MySQL', 'MariaDB'):
                with c.cursor() as cur:
                    cur.execute(f"USE `{db_name}`")
                    cur.execute(f"DESCRIBE `{table_name}`")
                    rows = cur.fetchall()
                    info = {}
                    for r in rows:
                        field = r['Field'] if isinstance(r, dict) else r[0]
                        raw_type = r['Type'] if isinstance(r, dict) else r[1]
                        null = r['Null'] if isinstance(r, dict) else r[2]
                        key = r['Key'] if isinstance(r, dict) else r[3]
                        default = r['Default'] if isinstance(r, dict) else r[4]
                        extra = r['Extra'] if isinstance(r, dict) else r[5]
                        
                        col_info = {
                            'type': raw_type,
                            'null': (null == 'YES'),
                            'key': key,
                            'default': default,
                            'extra': extra,
                            'max_length': self._parse_max_length(raw_type),
                            'is_auto_increment': ('auto_increment' in extra.lower()),
                            'is_primary_key': (key == 'PRI')
                        }
                        info[field] = col_info
                    self._log_info(f"获取列信息成功: {conn_name}/{db_name}/{table_name}, 列数: {len(info)}")
                    return info
            elif t == 'PostgreSQL':
                with c.cursor() as cur:
                    cur.execute("""
                        SELECT 
                            c.column_name,
                            c.data_type,
                            c.character_maximum_length,
                            c.is_nullable,
                            c.column_default,
                            tc.constraint_type
                        FROM information_schema.columns c
                        LEFT JOIN information_schema.key_column_usage kcu 
                            ON c.table_name = kcu.table_name AND c.column_name = kcu.column_name
                        LEFT JOIN information_schema.table_constraints tc 
                            ON kcu.constraint_name = tc.constraint_name
                        WHERE c.table_schema='public' AND c.table_name=%s
                        ORDER BY c.ordinal_position
                    """, (table_name,))
                    info = {}
                    for r in cur.fetchall():
                        col_info = {
                            'type': r[1],
                            'null': (r[3] == 'YES'),
                            'max_length': r[2],
                            'default': r[4],
                            'key': 'PRI' if r[5] == 'PRIMARY KEY' else '',
                            'extra': '',
                            'is_auto_increment': False,
                            'is_primary_key': (r[5] == 'PRIMARY KEY')
                        }
                        info[r[0]] = col_info
                    self._log_info(f"获取列信息成功: {conn_name}/{db_name}/{table_name}, 列数: {len(info)}")
                    return info
            elif t == 'SQL Server':
                with c.cursor() as cur:
                    cur.execute(f"""
                        USE [{db_name}];
                        SELECT 
                            c.name AS column_name,
                            t.name AS data_type,
                            c.max_length,
                            c.is_nullable,
                            dc.definition AS column_default,
                            CASE WHEN ic.index_column_id IS NOT NULL AND i.is_primary_key = 1 THEN 'PRI' ELSE '' END AS key_type
                        FROM sys.columns c
                        JOIN sys.types t ON c.system_type_id = t.system_type_id
                        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
                        LEFT JOIN sys.index_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                        LEFT JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                        WHERE c.object_id = OBJECT_ID('{table_name}')
                        ORDER BY c.column_id
                    """)
                    info = {}
                    for r in cur.fetchall():
                        col_info = {
                            'type': r[1],
                            'null': bool(r[3]),
                            'max_length': r[2],
                            'default': r[4],
                            'key': r[5],
                            'extra': '',
                            'is_auto_increment': False,
                            'is_primary_key': (r[5] == 'PRI')
                        }
                        info[r[0]] = col_info
                    self._log_info(f"获取列信息成功: {conn_name}/{db_name}/{table_name}, 列数: {len(info)}")
                    return info
            return {}
        except Exception as e:
            self._log_error(f"获取列信息失败 [{conn_name}/{db_name}/{table_name}]: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            return {}
        finally:
            self.pool.release_connection(conn_name)

    def _parse_max_length(self, raw_type):
        """解析最大长度"""
        m = re.search(r'(?:var)?char\((\d+)\)', raw_type, re.IGNORECASE)
        if m:
            return int(m.group(1))
        m = re.search(r'varchar2?\((\d+)\)', raw_type, re.IGNORECASE)
        if m:
            return int(m.group(1))
        return None

    def _truncate_value(self, val, max_length):
        """截断值"""
        if max_length is None or not isinstance(val, str):
            return val
        encoded = val.encode('utf-8')
        if len(encoded) <= max_length:
            return val
        while len(encoded) > max_length:
            val = val[:-1]
            encoded = val.encode('utf-8')
        return val

    def fetch_table_rows(self, conn_name, db_name, table_name, columns, limit=0, offset=0):
        """获取表数据"""
        self._log_info(f"获取表数据: {conn_name}/{db_name}/{table_name}, 限制: {limit}, 偏移: {offset}")
        c, t = self._get_conn(conn_name)
        if not c:
            self._log_error(f"无法建立连接: {conn_name}")
            return [], 0
        cols = ", ".join(f"`{col}`" for col in columns)
        sql = f"SELECT {cols} FROM `{table_name}`"
        total_count = 0
        
        try:
            if t in ('MySQL', 'MariaDB'):
                with c.cursor() as cur:
                    cur.execute(f"USE `{db_name}`")
                    cur.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                    count_result = cur.fetchone()
                    if isinstance(count_result, dict):
                        total_count = count_result.get('COUNT(*)', 0)
                    else:
                        total_count = count_result[0]
                    
                    if limit is not None and limit > 0:
                        sql += f" LIMIT {offset}, {limit}"
                    cur.execute(sql)
                    rows = cur.fetchall()
                    result = [{col: (row[col] if isinstance(row, dict) else row[i])
                             for i, col in enumerate(columns)} for row in rows]
                    self._log_info(f"获取表数据成功: {conn_name}/{db_name}/{table_name}, 行数: {len(result)}, 总数: {total_count}")
                    return result, total_count
            elif t == 'PostgreSQL':
                with c.cursor() as cur:
                    cur.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
                    total_count = cur.fetchone()[0]
                    
                    cols_pg = ", ".join(f'"{col}"' for col in columns)
                    sql_pg = f"SELECT {cols_pg} FROM \"{table_name}\""
                    if limit is not None and limit > 0:
                        sql_pg += f" OFFSET {offset} LIMIT {limit}"
                    cur.execute(sql_pg)
                    rows = cur.fetchall()
                    result = [{col: row[i] for i, col in enumerate(columns)} for row in rows]
                    self._log_info(f"获取表数据成功: {conn_name}/{db_name}/{table_name}, 行数: {len(result)}, 总数: {total_count}")
                    return result, total_count
            elif t == 'SQL Server':
                with c.cursor() as cur:
                    cur.execute(f"USE [{db_name}]; SELECT COUNT(*) FROM [{table_name}]")
                    total_count = cur.fetchone()[0]
                    
                    cols_ss = ", ".join(f"[{col}]" for col in columns)
                    if limit is not None and limit > 0:
                        sql_ss = f"""
                            SELECT {cols_ss} FROM (
                                SELECT {cols_ss}, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
                                FROM [{table_name}]
                            ) AS t WHERE rn > {offset} AND rn <= {offset + limit}
                        """
                    else:
                        sql_ss = f"SELECT {cols_ss} FROM [{table_name}]"
                    cur.execute(sql_ss)
                    rows = cur.fetchall()
                    result = [{col: row[i] for i, col in enumerate(columns)} for row in rows]
                    self._log_info(f"获取表数据成功: {conn_name}/{db_name}/{table_name}, 行数: {len(result)}, 总数: {total_count}")
                    return result, total_count
            return [], 0
        except Exception as e:
            self._log_error(f"获取表数据失败 [{conn_name}/{db_name}/{table_name}]: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            return [], 0
        finally:
            self.pool.release_connection(conn_name)

    # ──────────── 数据比对逻辑 ────────────

    @track_operation('SyncEngine.compare_tables')
    def compare_tables(self, src_name, src_db, src_tables, tgt_name, tgt_db, progress_callback=None):
        """比对表数据"""
        self._log_info(f"开始比对表数据: {src_name}/{src_db} -> {tgt_name}/{tgt_db}, 表数量: {len(src_tables)}")
        result = {}
        total_tables = len(src_tables)
        
        for i, tbl in enumerate(sorted(src_tables)):
            if progress_callback:
                progress_callback(tbl, i, total_tables)
            
            self._log_info(f"比对表: {tbl} ({i+1}/{total_tables})")
            
            pk_cols = self.get_primary_keys(src_name, src_db, tbl)
            columns = self.get_column_names(src_name, src_db, tbl)
            tgt_cols = self.get_column_names(tgt_name, tgt_db, tbl)
            
            if not columns:
                self._log_warning(f"源表不存在或无法访问: {tbl}")
                result[tbl] = {
                    'src_columns': [],
                    'tgt_columns': [],
                    'pk_cols': [],
                    'pk_name': '',
                    'insert': 0,
                    'update': 0,
                    'delete': 0,
                    'same': 0,
                    'info': '源表不存在或无法访问',
                    'diff_rows': [],
                    'src_rows_count': 0,
                    'tgt_rows_count': 0,
                    'src_col_info': {},
                    'tgt_col_info': {}
                }
                continue

            src_info = self.get_column_info(src_name, src_db, tbl)
            tgt_info = self.get_column_info(tgt_name, tgt_db, tbl)

            src_rows, src_total = self.fetch_table_rows(src_name, src_db, tbl, columns, 0)
            tgt_rows, tgt_total = self.fetch_table_rows(tgt_name, tgt_db, tbl, tgt_cols, 0)

            pk_name = pk_cols[0] if pk_cols else columns[0]

            def pk_key(row):
                return str(row.get(pk_name, ''))

            src_map = {pk_key(r): r for r in src_rows}
            tgt_map = {pk_key(r): r for r in tgt_rows}

            insert_count = update_count = delete_count = same_count = 0
            diff_rows = []

            for pk, srow in src_map.items():
                if pk not in tgt_map:
                    insert_count += 1
                    diff_rows.append({'type': 'insert', 'pk': pk, 'src': srow, 'tgt': None})
                else:
                    trow = tgt_map[pk]
                    changed = {}
                    for col in columns:
                        sv = srow.get(col)
                        tv = trow.get(col) if col in tgt_cols else None
                        if str(sv) != str(tv):
                            changed[col] = {'src': sv, 'tgt': tv}
                    if changed:
                        update_count += 1
                        diff_rows.append({'type': 'update', 'pk': pk, 'src': srow, 'tgt': trow, 'changed': changed})
                    else:
                        same_count += 1

            for pk, trow in tgt_map.items():
                if pk not in src_map:
                    delete_count += 1
                    diff_rows.append({'type': 'delete', 'pk': pk, 'src': None, 'tgt': trow})

            has_struct_diff = len(columns) != len(tgt_cols) or set(columns) != set(tgt_cols)
            struct_diff_details = []
            
            if not has_struct_diff and src_info and tgt_info:
                for col in columns:
                    if col in src_info and col in tgt_info:
                        st = src_info[col]['type']
                        tt = tgt_info[col]['type']
                        if st.lower() != tt.lower():
                            has_struct_diff = True
                            struct_diff_details.append(f"{col}: {st} → {tt}")
                        
                        sn = src_info[col]['null']
                        tn = tgt_info[col]['null']
                        if sn != tn:
                            has_struct_diff = True
                            struct_diff_details.append(f"{col}: 可空性 {sn} → {tn}")
            
            info = ""
            if has_struct_diff:
                if struct_diff_details:
                    info = "结构差异: " + "; ".join(struct_diff_details)
                else:
                    info = "表结构不一致"
            if not pk_cols:
                info = (info + "; " if info else "") + "无主键"

            result[tbl] = {
                'src_columns': columns,
                'tgt_columns': tgt_cols,
                'pk_cols': pk_cols,
                'pk_name': pk_name,
                'insert': insert_count,
                'update': update_count,
                'delete': delete_count,
                'same': same_count,
                'info': info,
                'diff_rows': diff_rows,
                'src_rows_count': src_total,
                'tgt_rows_count': tgt_total,
                'src_col_info': src_info,
                'tgt_col_info': tgt_info,
            }
        
        self._log_info(f"表比对完成: 共 {len(result)} 张表")
        return result

    def _log_warning(self, message):
        """记录警告日志"""
        if self.logger:
            self.logger.log('INFO', f"[SyncEngine][WARNING] {message}")

    # ──────────── 同步执行 ────────────

    def execute_sync(self, tgt_name, tgt_db, tables_cache, on_progress=None, on_done=None):
        """执行同步"""
        self._log_info(f"开始执行同步: {tgt_name}/{tgt_db}, 表数量: {len(tables_cache)}")
        c, t = self._get_conn(tgt_name)
        if not c:
            if on_done:
                on_done(False, "无法连接目标数据库")
            return

        total_affected = 0
        errors = []

        try:
            if t in ('MySQL', 'MariaDB'):
                c.autocommit(False)
            
            for tbl_name, info in tables_cache.items():
                self._log_info(f"同步表: {tbl_name}")
                pk_name = info['pk_name']
                src_cols = info['src_columns']
                tgt_col_info = info.get('tgt_col_info', {})

                if not info['pk_cols']:
                    errors.append(f"{tbl_name}: 无主键，跳过同步")
                    self._log_warning(f"{tbl_name}: 无主键，跳过同步")
                    continue

                diff_rows = info['diff_rows']
                self._log_info(f"表 {tbl_name} 需要同步 {len(diff_rows)} 行数据")

                for dr in diff_rows:
                    dtype = dr['type']
                    pk_val = dr['pk']

                    if dtype == 'delete':
                        if t in ('MySQL', 'MariaDB'):
                            sql = f"DELETE FROM `{tbl_name}` WHERE `{pk_name}` = %s"
                            with c.cursor() as cur:
                                cur.execute(f"USE `{tgt_db}`")
                                cur.execute(sql, (pk_val,))
                        elif t == 'PostgreSQL':
                            sql = f'DELETE FROM "{tbl_name}" WHERE "{pk_name}" = %s'
                            with c.cursor() as cur:
                                cur.execute(sql, (pk_val,))
                        elif t == 'SQL Server':
                            sql = f'DELETE FROM [{tbl_name}] WHERE [{pk_name}] = %s'
                            with c.cursor() as cur:
                                cur.execute(f"USE [{tgt_db}]")
                                cur.execute(sql, (pk_val,))
                        total_affected += 1

                    elif dtype == 'update':
                        changed = dr.get('changed', {})
                        if not changed:
                            continue
                        if not info['pk_cols']:
                            continue
                        
                        if t in ('MySQL', 'MariaDB'):
                            parts = []
                            vals = []
                            for col in changed:
                                val = changed[col]['src']
                                max_len = tgt_col_info.get(col, {}).get('max_length') if tgt_col_info else None
                                val = self._truncate_value(val, max_len)
                                parts.append(f"`{col}` = %s")
                                vals.append(val)
                            vals.append(pk_val)
                            sets = ", ".join(parts)
                            sql = f"UPDATE `{tbl_name}` SET {sets} WHERE `{pk_name}` = %s"
                            with c.cursor() as cur:
                                cur.execute(f"USE `{tgt_db}`")
                                cur.execute(sql, tuple(vals))
                        elif t == 'PostgreSQL':
                            parts = []
                            vals = []
                            for col in changed:
                                val = changed[col]['src']
                                parts.append(f'"{col}" = %s')
                                vals.append(val)
                            vals.append(pk_val)
                            sets = ", ".join(parts)
                            sql = f'UPDATE "{tbl_name}" SET {sets} WHERE "{pk_name}" = %s'
                            with c.cursor() as cur:
                                cur.execute(sql, tuple(vals))
                        elif t == 'SQL Server':
                            parts = []
                            vals = []
                            for col in changed:
                                val = changed[col]['src']
                                parts.append(f"[{col}] = %s")
                                vals.append(val)
                            vals.append(pk_val)
                            sets = ", ".join(parts)
                            sql = f'UPDATE [{tbl_name}] SET {sets} WHERE [{pk_name}] = %s'
                            with c.cursor() as cur:
                                cur.execute(f"USE [{tgt_db}]")
                                cur.execute(sql, tuple(vals))
                        total_affected += 1

                    elif dtype == 'insert':
                        srow = dr['src']
                        if not srow:
                            continue
                        cols_list = [col for col in src_cols if col in srow]
                        vals_list = []
                        for col in cols_list:
                            val = srow[col]
                            max_len = tgt_col_info.get(col, {}).get('max_length') if tgt_col_info else None
                            val = self._truncate_value(val, max_len)
                            vals_list.append(val)
                        if not cols_list:
                            continue
                        
                        if t in ('MySQL', 'MariaDB'):
                            cols_str = ", ".join(f"`{col}`" for col in cols_list)
                            placeholders = ", ".join(["%s"] * len(cols_list))
                            sql = f"INSERT INTO `{tbl_name}` ({cols_str}) VALUES ({placeholders})"
                            with c.cursor() as cur:
                                cur.execute(f"USE `{tgt_db}`")
                                cur.execute(sql, tuple(vals_list))
                        elif t == 'PostgreSQL':
                            cols_str = ", ".join(f'"{col}"' for col in cols_list)
                            placeholders = ", ".join(["%s"] * len(cols_list))
                            sql = f'INSERT INTO "{tbl_name}" ({cols_str}) VALUES ({placeholders})'
                            with c.cursor() as cur:
                                cur.execute(sql, tuple(vals_list))
                        elif t == 'SQL Server':
                            cols_str = ", ".join(f"[{col}]" for col in cols_list)
                            placeholders = ", ".join(["%s"] * len(cols_list))
                            sql = f'INSERT INTO [{tbl_name}] ({cols_str}) VALUES ({placeholders})'
                            with c.cursor() as cur:
                                cur.execute(f"USE [{tgt_db}]")
                                cur.execute(sql, tuple(vals_list))
                        total_affected += 1

                    if on_progress:
                        on_progress(total_affected)

            if t in ('MySQL', 'MariaDB', 'PostgreSQL'):
                c.commit()

            self._log_info(f"同步执行成功, 影响 {total_affected} 行")
            if on_done:
                msg = f"同步完成！影响 {total_affected} 行"
                if errors:
                    msg += f"\n\n警告({len(errors)}):\n" + "\n".join(errors)
                on_done(True, msg)

        except Exception as e:
            if t in ('MySQL', 'MariaDB', 'PostgreSQL'):
                try:
                    c.rollback()
                    self._log_info("同步失败，已回滚事务")
                except Exception:
                    pass
            self._log_error(f"同步执行失败: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            if on_done:
                on_done(False, f"同步执行失败:\n{e}")
        finally:
            self.pool.release_connection(tgt_name)

    # ──────────── 数据传输（无比对，直接复制） ────────────

    def transfer_data(self, src_name, src_db, tgt_name, tgt_db, table_names, 
                      on_progress=None, on_done=None, batch_size=1000, truncate_target=True):
        """传输数据"""
        self._log_info(f"开始数据传输: {src_name}/{src_db} -> {tgt_name}/{tgt_db}, 表数量: {len(table_names)}")
        sc, st = self._get_conn(src_name)
        tc, tt = self._get_conn(tgt_name)
        if not sc or not tc:
            self._log_error("无法连接源或目标数据库")
            if on_done:
                on_done(False, "无法连接源或目标数据库")
            return

        total_rows = 0
        errors = []

        try:
            if tt in ('MySQL', 'MariaDB', 'PostgreSQL'):
                tc.autocommit(False)

            for tbl in table_names:
                self._log_info(f"传输表: {tbl}")
                columns = self.get_column_names(src_name, src_db, tbl)
                if not columns:
                    errors.append(f"{tbl}: 无法获取列信息，跳过")
                    self._log_warning(f"{tbl}: 无法获取列信息，跳过")
                    continue

                if tt in ('MySQL', 'MariaDB'):
                    with tc.cursor() as cur:
                        cur.execute(f"USE `{tgt_db}`")
                        if truncate_target:
                            cur.execute(f"TRUNCATE TABLE `{tbl}`")
                elif tt == 'PostgreSQL':
                    with tc.cursor() as cur:
                        if truncate_target:
                            cur.execute(f'TRUNCATE TABLE "{tbl}"')
                elif tt == 'SQL Server':
                    with tc.cursor() as cur:
                        cur.execute(f"USE [{tgt_db}]")
                        if truncate_target:
                            cur.execute(f'TRUNCATE TABLE [{tbl}]')

                offset = 0
                while True:
                    rows, total = self.fetch_table_rows(src_name, src_db, tbl, columns, batch_size, offset)
                    if not rows:
                        break

                    if tt in ('MySQL', 'MariaDB'):
                        cols_str = ", ".join(f"`{col}`" for col in columns)
                        placeholders = ", ".join(["%s"] * len(columns))
                        insert_sql = f"INSERT INTO `{tbl}` ({cols_str}) VALUES ({placeholders})"
                        with tc.cursor() as cur:
                            cur.execute(f"USE `{tgt_db}`")
                            for row in rows:
                                vals = tuple(row.get(col) for col in columns)
                                cur.execute(insert_sql, vals)
                        tc.commit()

                    elif tt == 'PostgreSQL':
                        cols_str = ", ".join(f'"{col}"' for col in columns)
                        placeholders = ", ".join(["%s"] * len(columns))
                        insert_sql = f'INSERT INTO "{tbl}" ({cols_str}) VALUES ({placeholders})'
                        with tc.cursor() as cur:
                            for row in rows:
                                vals = tuple(row.get(col) for col in columns)
                                cur.execute(insert_sql, vals)
                        tc.commit()

                    elif tt == 'SQL Server':
                        cols_str = ", ".join(f"[{col}]" for col in columns)
                        placeholders = ", ".join(["%s"] * len(columns))
                        insert_sql = f'INSERT INTO [{tbl}] ({cols_str}) VALUES ({placeholders})'
                        with tc.cursor() as cur:
                            cur.execute(f"USE [{tgt_db}]")
                            for row in rows:
                                vals = tuple(row.get(col) for col in columns)
                                cur.execute(insert_sql, vals)

                    total_rows += len(rows)
                    offset += batch_size

                    if on_progress:
                        on_progress(total_rows, tbl)

            self._log_info(f"数据传输完成, 共处理 {total_rows} 行")
            if on_done:
                msg = f"数据传输完成！共处理 {total_rows} 行"
                if errors:
                    msg += f"\n\n警告({len(errors)}):\n" + "\n".join(errors)
                on_done(True, msg)

        except Exception as e:
            try:
                if tt in ('MySQL', 'MariaDB', 'PostgreSQL'):
                    tc.rollback()
                    self._log_info("数据传输失败，已回滚事务")
            except Exception:
                pass
            self._log_error(f"数据传输失败: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            if on_done:
                on_done(False, f"数据传输失败:\n{e}")
        finally:
            self.pool.release_connection(src_name)
            self.pool.release_connection(tgt_name)

    # ──────────── 结构比对 ────────────

    def compare_structures(self, src_name, src_db, tgt_name, tgt_db):
        """比对结构"""
        self._log_info(f"开始结构比对: {src_name}/{src_db} -> {tgt_name}/{tgt_db}")
        src_tables = set(self.fetch_tables(src_name, src_db))
        tgt_tables = set(self.fetch_tables(tgt_name, tgt_db))

        result = {
            'only_in_source': [],
            'only_in_target': [],
            'same': [],
            'different': [],
            'table_details': {}
        }

        only_src = src_tables - tgt_tables
        only_tgt = tgt_tables - src_tables
        common = src_tables & tgt_tables

        result['only_in_source'] = sorted(only_src)
        result['only_in_target'] = sorted(only_tgt)

        for tbl in sorted(common):
            self._log_info(f"比对表结构: {tbl}")
            src_cols_info = self.get_column_info(src_name, src_db, tbl)
            tgt_cols_info = self.get_column_info(tgt_name, tgt_db, tbl)
            
            src_cols = set(src_cols_info.keys())
            tgt_cols = set(tgt_cols_info.keys())
            
            is_same = True
            col_diffs = []
            
            if src_cols != tgt_cols:
                is_same = False
                missing_in_tgt = src_cols - tgt_cols
                missing_in_src = tgt_cols - src_cols
                if missing_in_tgt:
                    col_diffs.append(f"目标缺失列: {', '.join(sorted(missing_in_tgt))}")
                if missing_in_src:
                    col_diffs.append(f"源缺失列: {', '.join(sorted(missing_in_src))}")
            else:
                for col in src_cols:
                    src_info = src_cols_info[col]
                    tgt_info = tgt_cols_info[col]
                    if src_info['type'].lower() != tgt_info['type'].lower():
                        is_same = False
                        col_diffs.append(f"{col}: {src_info['type']} → {tgt_info['type']}")
                    elif src_info['null'] != tgt_info['null']:
                        is_same = False
                        col_diffs.append(f"{col}: 可空性 {src_info['null']} → {tgt_info['null']}")
            
            result['table_details'][tbl] = {
                'src_cols_info': src_cols_info,
                'tgt_cols_info': tgt_cols_info,
                'differences': col_diffs,
                'is_same': is_same
            }
            
            if is_same:
                result['same'].append(tbl)
            else:
                result['different'].append(tbl)

        self._log_info(f"结构比对完成: 仅源有 {len(result['only_in_source'])} 张表, 仅目标有 {len(result['only_in_target'])} 张表, 相同 {len(result['same'])} 张, 不同 {len(result['different'])} 张")
        return result

    def generate_structure_sql(self, result, src_name, src_db, tgt_name, tgt_db, selected_tables=None):
        """生成结构SQL"""
        self._log_info(f"生成结构SQL")
        sqls = []
        src_conn, src_type = self._get_conn(src_name)
        
        only_in_source_tables = selected_tables.get('only_in_source', result['only_in_source']) if selected_tables else result['only_in_source']
        only_in_target_tables = selected_tables.get('only_in_target', result['only_in_target']) if selected_tables else result['only_in_target']
        different_tables = selected_tables.get('different', result['different']) if selected_tables else result['different']
        
        for tbl in only_in_source_tables:
            cols_info = result['table_details'].get(tbl, {}).get('src_cols_info', {})
            if not cols_info:
                cols_info = self.get_column_info(src_name, src_db, tbl)
            
            if src_type in ('MySQL', 'MariaDB'):
                sql = self._generate_create_table_mysql(tbl, cols_info)
            elif src_type == 'PostgreSQL':
                sql = self._generate_create_table_postgresql(tbl, cols_info)
            elif src_type == 'SQL Server':
                sql = self._generate_create_table_sqlserver(tbl, cols_info)
            else:
                sql = self._generate_create_table_mysql(tbl, cols_info)
            
            if sql:
                sqls.append(sql)

        for tbl in only_in_target_tables:
            if src_type in ('MySQL', 'MariaDB'):
                sqls.append(f"DROP TABLE IF EXISTS `{tbl}`;")
            elif src_type == 'PostgreSQL':
                sqls.append(f'DROP TABLE IF EXISTS "{tbl}";')
            elif src_type == 'SQL Server':
                sqls.append(f'DROP TABLE IF EXISTS [{tbl}];')

        for tbl in different_tables:
            details = result['table_details'].get(tbl, {})
            src_cols_info = details.get('src_cols_info', {})
            tgt_cols_info = details.get('tgt_cols_info', {})
            
            if not src_cols_info:
                src_cols_info = self.get_column_info(src_name, src_db, tbl)
            if not tgt_cols_info:
                tgt_cols_info = self.get_column_info(tgt_name, tgt_db, tbl)
            
            src_cols = set(src_cols_info.keys())
            tgt_cols = set(tgt_cols_info.keys())
            
            for col in sorted(src_cols - tgt_cols):
                col_info = src_cols_info[col]
                if src_type in ('MySQL', 'MariaDB'):
                    sqls.append(f"ALTER TABLE `{tbl}` ADD COLUMN `{col}` {col_info['type']}{'' if col_info['null'] else ' NOT NULL'};")
                elif src_type == 'PostgreSQL':
                    sqls.append(f'ALTER TABLE "{tbl}" ADD COLUMN "{col}" {col_info["type"]}{"" if col_info["null"] else " NOT NULL"};')
                elif src_type == 'SQL Server':
                    sqls.append(f'ALTER TABLE [{tbl}] ADD [{col}] {col_info["type"]}{"" if col_info["null"] else " NOT NULL"};')
            
            for col in sorted(tgt_cols - src_cols):
                if src_type in ('MySQL', 'MariaDB'):
                    sqls.append(f"ALTER TABLE `{tbl}` DROP COLUMN `{col}`;")
                elif src_type == 'PostgreSQL':
                    sqls.append(f'ALTER TABLE "{tbl}" DROP COLUMN "{col}";')
                elif src_type == 'SQL Server':
                    sqls.append(f'ALTER TABLE [{tbl}] DROP COLUMN [{col}];')
            
            for col in sorted(src_cols & tgt_cols):
                src_info = src_cols_info[col]
                tgt_info = tgt_cols_info[col]
                
                if src_info['type'].lower() != tgt_info['type'].lower():
                    if src_type in ('MySQL', 'MariaDB'):
                        sqls.append(f"ALTER TABLE `{tbl}` MODIFY COLUMN `{col}` {src_info['type']}{'' if src_info['null'] else ' NOT NULL'};")
                    elif src_type == 'PostgreSQL':
                        sqls.append(f'ALTER TABLE "{tbl}" ALTER COLUMN "{col}" TYPE {src_info["type"]};')
                    elif src_type == 'SQL Server':
                        sqls.append(f'ALTER TABLE [{tbl}] ALTER COLUMN [{col}] {src_info["type"]}{"" if src_info["null"] else " NOT NULL"};')
        
        if src_conn:
            self.pool.release_connection(src_name)
        
        self._log_info(f"结构SQL生成完成, 共 {len(sqls)} 条语句")
        return sqls

    def _generate_create_table_mysql(self, table_name, cols_info):
        """生成MySQL建表语句"""
        if not cols_info:
            return None
        
        parts = []
        pk_cols = []
        
        for col_name, col_info in cols_info.items():
            col_def = f"`{col_name}` {col_info['type']}"
            if not col_info['null']:
                col_def += " NOT NULL"
            if col_info['default'] is not None:
                col_def += f" DEFAULT {col_info['default']}"
            if col_info['is_auto_increment']:
                col_def += " AUTO_INCREMENT"
            parts.append(f"  {col_def}")
            if col_info['is_primary_key']:
                pk_cols.append(f"`{col_name}`")
        
        if pk_cols:
            parts.append(f"  PRIMARY KEY ({', '.join(pk_cols)})")
        
        return f"CREATE TABLE `{table_name}` (\n" + ",\n".join(parts) + "\n);"

    def _generate_create_table_postgresql(self, table_name, cols_info):
        """生成PostgreSQL建表语句"""
        if not cols_info:
            return None
        
        parts = []
        pk_cols = []
        
        for col_name, col_info in cols_info.items():
            col_def = f'"{col_name}" {col_info["type"]}'
            if not col_info['null']:
                col_def += " NOT NULL"
            if col_info['default'] is not None:
                col_def += f" DEFAULT {col_info['default']}"
            parts.append(f"  {col_def}")
            if col_info['is_primary_key']:
                pk_cols.append(f'"{col_name}"')
        
        if pk_cols:
            parts.append(f"  PRIMARY KEY ({', '.join(pk_cols)})")
        
        return f'CREATE TABLE "{table_name}" (\n' + ",\n".join(parts) + "\n);"

    def _generate_create_table_sqlserver(self, table_name, cols_info):
        """生成SQL Server建表语句"""
        if not cols_info:
            return None
        
        parts = []
        pk_cols = []
        
        for col_name, col_info in cols_info.items():
            col_def = f"[{col_name}] {col_info['type']}"
            if not col_info['null']:
                col_def += " NOT NULL"
            if col_info['default'] is not None:
                col_def += f" DEFAULT {col_info['default']}"
            parts.append(f"  {col_def}")
            if col_info['is_primary_key']:
                pk_cols.append(f"[{col_name}]")
        
        if pk_cols:
            parts.append(f"  PRIMARY KEY ({', '.join(pk_cols)})")
        
        return f"CREATE TABLE [{table_name}] (\n" + ",\n".join(parts) + "\n);"

    def execute_sql(self, tgt_name, tgt_db, sql_statements, on_done=None):
        """执行SQL"""
        self._log_info(f"执行SQL语句: {len(sql_statements)} 条")
        c, t = self._get_conn(tgt_name)
        if not c:
            self._log_error("无法连接目标数据库")
            if on_done:
                on_done(False, "无法连接目标数据库")
            return

        executed = 0
        errors = []

        try:
            if t in ('MySQL', 'MariaDB', 'PostgreSQL'):
                c.autocommit(False)

            for sql in sql_statements:
                if not sql.strip():
                    continue
                try:
                    if t in ('MySQL', 'MariaDB'):
                        with c.cursor() as cur:
                            cur.execute(f"USE `{tgt_db}`")
                            cur.execute(sql)
                    elif t == 'PostgreSQL':
                        with c.cursor() as cur:
                            cur.execute(sql)
                    elif t == 'SQL Server':
                        with c.cursor() as cur:
                            cur.execute(f"USE [{tgt_db}]")
                            cur.execute(sql)
                    executed += 1
                except Exception as e:
                    errors.append(f"{sql[:60]}...: {e}")
                    self._log_warning(f"SQL执行失败: {sql[:60]}...: {e}")

            if t in ('MySQL', 'MariaDB', 'PostgreSQL'):
                c.commit()

            self._log_info(f"SQL执行完成: 成功 {executed} 条, 失败 {len(errors)} 条")
            msg = f"执行完成！成功 {executed} 条"
            if errors:
                msg += f"\n失败 {len(errors)} 条:\n" + "\n".join(errors[:5])
            if on_done:
                on_done(True, msg)

        except Exception as e:
            try:
                if t in ('MySQL', 'MariaDB', 'PostgreSQL'):
                    c.rollback()
                    self._log_info("SQL执行失败，已回滚事务")
            except Exception:
                pass
            self._log_error(f"SQL执行失败: {e}")
            self._log_error(f"错误堆栈: {traceback.format_exc()}")
            if on_done:
                on_done(False, f"执行失败:\n{e}")
        finally:
            self.pool.release_connection(tgt_name)

    def compare_all_tables(self, src_conn, src_db, tgt_conn, tgt_db, tables, on_progress=None):
        """比对所有表的数据差异"""
        self._log_info(f"开始比对所有表: {src_conn}/{src_db} -> {tgt_conn}/{tgt_db}, 表数量: {len(tables)}")
        results = {}
        
        for i, table_name in enumerate(sorted(tables)):
            if on_progress:
                on_progress(table_name, f"{i+1}/{len(tables)}")
            
            self._log_info(f"比对表: {table_name}")
            result = self._compare_single_table(src_conn, src_db, tgt_conn, tgt_db, table_name)
            results[table_name] = result
        
        self._log_info(f"表比对完成, 共比对 {len(results)} 张表")
        return results
    
    def _compare_single_table(self, src_conn, src_db, tgt_conn, tgt_db, table_name):
        """比对单张表的数据差异"""
        result = {
            'src_count': 0,
            'tgt_count': 0,
            'insert_count': 0,
            'update_count': 0,
            'delete_count': 0,
        }
        
        try:
            # 获取源表行数
            src_count = self._get_table_row_count(src_conn, src_db, table_name)
            result['src_count'] = src_count
            
            # 获取目标表行数
            tgt_count = self._get_table_row_count(tgt_conn, tgt_db, table_name)
            result['tgt_count'] = tgt_count
            
            # 如果两边都为空，直接返回
            if src_count == 0 and tgt_count == 0:
                return result
            
            # 获取主键信息
            pk_cols = self.get_primary_keys(src_conn, src_db, table_name)
            
            if pk_cols:
                # 有主键，进行详细比对
                result.update(self._compare_table_with_pk(src_conn, src_db, tgt_conn, tgt_db, table_name, pk_cols))
            else:
                # 无主键，只能比较行数
                result['insert_count'] = max(0, src_count - tgt_count)
                result['delete_count'] = max(0, tgt_count - src_count)
                
        except Exception as e:
            self._log_error(f"比对表失败 {table_name}: {e}")
        
        return result
    
    def _get_table_row_count(self, conn_name, db_name, table_name):
        """获取表行数"""
        conn = None
        try:
            conn, conn_type = self._get_conn(conn_name)
            if conn:
                if conn_type in ('MySQL', 'MariaDB'):
                    with conn.cursor() as cur:
                        cur.execute(f"USE `{db_name}`")
                        cur.execute(f"SELECT COUNT(*) FROM `{table_name}`")
                        fetch_result = cur.fetchone()
                        if fetch_result:
                            if isinstance(fetch_result, dict):
                                result = fetch_result.get('COUNT(*)', 0)
                            else:
                                result = fetch_result[0]
                            return result
                elif conn_type == 'PostgreSQL':
                    with conn.cursor() as cur:
                        cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                        return cur.fetchone()[0]
                elif conn_type == 'SQL Server':
                    with conn.cursor() as cur:
                        cur.execute(f"USE [{db_name}]")
                        cur.execute(f'SELECT COUNT(*) FROM [{table_name}]')
                        return cur.fetchone()[0]
        except Exception as e:
            self._log_warning(f"获取表行数失败 {table_name}: {e}")
        finally:
            if conn:
                self.pool.release_connection(conn_name)
        return 0
    
    def _compare_table_with_pk(self, src_conn, src_db, tgt_conn, tgt_db, table_name, pk_cols):
        """使用主键比对表数据（优化版：使用分页和集合操作）"""
        result = {
            'insert_count': 0,
            'update_count': 0,
            'delete_count': 0,
        }
        
        try:
            src_cols = self.get_column_names(src_conn, src_db, table_name)
            tgt_cols = self.get_column_names(tgt_conn, tgt_db, table_name)
            
            if not src_cols or not tgt_cols:
                self._log_warning(f"无法获取表 {table_name} 的列信息")
                return result
            
            common_cols = list(set(src_cols) & set(tgt_cols))
            if not common_cols:
                self._log_warning(f"表 {table_name} 没有共同列")
                return result
            
            self._log_info(f"开始比对表 {table_name} 的数据，共同列数: {len(common_cols)}")
            
            # 优化：使用分页获取主键，避免一次性加载所有数据
            BATCH_SIZE = 5000
            src_pk_set = self._fetch_pk_values(src_conn, src_db, table_name, pk_cols, BATCH_SIZE)
            tgt_pk_set = self._fetch_pk_values(tgt_conn, tgt_db, table_name, pk_cols, BATCH_SIZE)
            
            self._log_info(f"表 {table_name} 主键获取完成，源主键数: {len(src_pk_set)}, 目标主键数: {len(tgt_pk_set)}")
            
            # 计算差异（使用集合操作，比字典更快）
            insert_count = len(src_pk_set - tgt_pk_set)
            delete_count = len(tgt_pk_set - src_pk_set)
            
            # 需要更新的记录数（需要逐行比较）
            common_pks = src_pk_set & tgt_pk_set
            update_count = 0
            
            if common_pks:
                update_count = self._count_updates_with_pagination(
                    src_conn, src_db, tgt_conn, tgt_db, table_name, 
                    pk_cols, common_cols, common_pks, BATCH_SIZE
                )
            
            result['insert_count'] = insert_count
            result['update_count'] = update_count
            result['delete_count'] = delete_count
            
            self._log_info(f"表 {table_name} 比对完成，新增: {insert_count}, 更新: {update_count}, 删除: {delete_count}")
            
        except Exception as e:
            self._log_error(f"使用主键比对表失败 {table_name}: {e}")
        
        return result

    def _fetch_pk_values(self, conn_name, db_name, table_name, pk_cols, batch_size=5000):
        """分页获取主键值集合"""
        conn, conn_type = self._get_conn(conn_name)
        if not conn:
            return set()
        
        pk_set = set()
        offset = 0
        
        try:
            pk_str = ", ".join(f"`{pk}`" for pk in pk_cols) if conn_type in ('MySQL', 'MariaDB') else \
                     ", ".join(f'"{pk}"' for pk in pk_cols) if conn_type == 'PostgreSQL' else \
                     ", ".join(f"[{pk}]" for pk in pk_cols)
            
            while True:
                if conn_type in ('MySQL', 'MariaDB'):
                    with conn.cursor() as cur:
                        cur.execute(f"USE `{db_name}`")
                        cur.execute(f"SELECT {pk_str} FROM `{table_name}` LIMIT {offset}, {batch_size}")
                        rows = cur.fetchall()
                elif conn_type == 'PostgreSQL':
                    with conn.cursor() as cur:
                        cur.execute(f'SELECT {pk_str} FROM "{table_name}" OFFSET {offset} LIMIT {batch_size}')
                        rows = cur.fetchall()
                elif conn_type == 'SQL Server':
                    with conn.cursor() as cur:
                        cur.execute(f"USE [{db_name}]")
                        cur.execute(f"""
                            SELECT {pk_str} FROM (
                                SELECT {pk_str}, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
                                FROM [{table_name}]
                            ) AS t WHERE rn > {offset} AND rn <= {offset + batch_size}
                        """)
                        rows = cur.fetchall()
                
                if not rows:
                    break
                
                for row in rows:
                    if isinstance(row, dict):
                        pk_val = tuple(row.get(pk) for pk in pk_cols)
                    else:
                        pk_val = tuple(row[i] for i in range(len(pk_cols)))
                    pk_set.add(pk_val)
                
                offset += batch_size
                
        finally:
            self.pool.release_connection(conn_name)
        
        return pk_set

    def _count_updates_with_pagination(self, src_conn, src_db, tgt_conn, tgt_db, table_name, pk_cols, common_cols, common_pks, batch_size=5000):
        """分页计算需要更新的记录数"""
        update_count = 0
        common_pk_list = list(common_pks)
        total_common = len(common_pk_list)
        
        for i in range(0, total_common, batch_size):
            batch_pks = common_pk_list[i:i+batch_size]
            update_count += self._compare_batch_rows(
                src_conn, src_db, tgt_conn, tgt_db, table_name, pk_cols, common_cols, batch_pks
            )
        
        return update_count

    def _compare_batch_rows(self, src_conn, src_db, tgt_conn, tgt_db, table_name, pk_cols, common_cols, pk_batch):
        """比对一批行数据"""
        if not pk_batch:
            return 0
        
        update_count = 0
        src_conn_obj, src_type = self._get_conn(src_conn)
        tgt_conn_obj, tgt_type = self._get_conn(tgt_conn)
        
        if not src_conn_obj or not tgt_conn_obj:
            return 0
        
        try:
            # 获取源表数据
            src_rows = self._fetch_rows_by_pks(src_conn_obj, src_type, src_db, table_name, pk_cols, common_cols, pk_batch)
            src_dict = {tuple(row[pk] for pk in pk_cols): row for row in src_rows}
            
            # 获取目标表数据
            tgt_rows = self._fetch_rows_by_pks(tgt_conn_obj, tgt_type, tgt_db, table_name, pk_cols, common_cols, pk_batch)
            tgt_dict = {tuple(row[pk] for pk in pk_cols): row for row in tgt_rows}
            
            # 比较差异
            for pk in src_dict:
                if pk in tgt_dict:
                    src_row = src_dict[pk]
                    tgt_row = tgt_dict[pk]
                    for col in common_cols:
                        if str(src_row.get(col)) != str(tgt_row.get(col)):
                            update_count += 1
                            break
            
        finally:
            self.pool.release_connection(src_conn)
            self.pool.release_connection(tgt_conn)
        
        return update_count

    def _fetch_rows_by_pks(self, conn, conn_type, db_name, table_name, pk_cols, cols, pk_batch):
        """根据主键批量获取行数据"""
        if not pk_batch:
            return []
        
        try:
            if conn_type in ('MySQL', 'MariaDB'):
                pk_placeholders = ", ".join(f"({', '.join(['%s'] * len(pk_cols))})" for _ in pk_batch)
                all_vals = []
                for pk in pk_batch:
                    all_vals.extend(pk)
                
                cols_str = ", ".join(f"`{col}`" for col in cols)
                pk_str = ", ".join(f"`{pk}`" for pk in pk_cols)
                
                with conn.cursor() as cur:
                    cur.execute(f"USE `{db_name}`")
                    cur.execute(f"SELECT {cols_str} FROM `{table_name}` WHERE ({pk_str}) IN ({pk_placeholders})", tuple(all_vals))
                    rows = cur.fetchall()
                    return [{col: (row[col] if isinstance(row, dict) else row[i]) for i, col in enumerate(cols)} for row in rows]
            
            elif conn_type == 'PostgreSQL':
                pk_placeholders = ", ".join(f"({', '.join(['%s'] * len(pk_cols))})" for _ in pk_batch)
                all_vals = []
                for pk in pk_batch:
                    all_vals.extend(pk)
                
                cols_str = ", ".join(f'"{col}"' for col in cols)
                pk_str = ", ".join(f'"{pk}"' for pk in pk_cols)
                
                with conn.cursor() as cur:
                    cur.execute(f'SELECT {cols_str} FROM "{table_name}" WHERE ({pk_str}) IN ({pk_placeholders})', tuple(all_vals))
                    rows = cur.fetchall()
                    return [{col: row[i] for i, col in enumerate(cols)} for row in rows]
            
            elif conn_type == 'SQL Server':
                # SQL Server 使用临时表方式处理批量主键查询
                cols_str = ", ".join(f"[{col}]" for col in cols)
                pk_str = ", ".join(f"[{pk}]" for pk in pk_cols)
                
                with conn.cursor() as cur:
                    cur.execute(f"USE [{db_name}]")
                    
                    temp_table_sql = "CREATE TABLE #TempPKs (" + ", ".join(f"[{pk}] VARCHAR(255)" for pk in pk_cols) + ")"
                    cur.execute(temp_table_sql)
                    
                    insert_sql = f"INSERT INTO #TempPKs ({pk_str}) VALUES " + ", ".join(f"({', '.join(['%s'] * len(pk_cols))})" for _ in pk_batch)
                    all_vals = []
                    for pk in pk_batch:
                        all_vals.extend(pk)
                    cur.execute(insert_sql, tuple(all_vals))
                    
                    cur.execute(f"SELECT t.* FROM [{table_name}] t JOIN #TempPKs p ON {''.join([f't.[{pk}] = p.[{pk}] AND ' for pk in pk_cols])[:-5]}")
                    rows = cur.fetchall()
                    
                    cur.execute("DROP TABLE #TempPKs")
                    
                    return [{col: row[i] for i, col in enumerate(cols)} for row in rows]
            
        except Exception as e:
            self._log_error(f"批量获取行数据失败: {e}")
        
        return []
    
    def generate_transfer_sql(self, src_conn, src_db, tgt_conn, tgt_db, tables, operations=None):
        """生成传输数据的SQL语句（预览模式，不执行）"""
        self._log_info(f"========== 生成传输SQL语句 ==========")
        self._log_info(f"源连接: {src_conn}/{src_db}")
        self._log_info(f"目标连接: {tgt_conn}/{tgt_db}")
        self._log_info(f"待传输表数量: {len(tables)}")
        self._log_info(f"操作配置: {operations if operations else '默认(全部执行)'}")
        
        sql_statements = {}
        
        op_map = {}
        if operations:
            for op in operations:
                op_map[op['table']] = op
        
        # 先比对所有表获取差异数据
        compare_results = self.compare_all_tables(src_conn, src_db, tgt_conn, tgt_db, tables, on_progress=None)
        
        for table_name in tables:
            table_op = op_map.get(table_name, {'insert': False, 'update': False, 'delete': False})
            
            # 检查是否有任何操作需要执行
            has_operation = table_op.get('insert', False) or table_op.get('update', False) or table_op.get('delete', False)
            
            if has_operation:
                # 获取该表的比对结果
                compare_result = compare_results.get(table_name, {})
                sql_statements[table_name] = self._generate_table_transfer_sql(
                    src_conn, src_db, tgt_conn, tgt_db, table_name, table_op, compare_result
                )
            else:
                # 如果没有任何操作需要执行，跳过该表
                self._log_info(f"表 {table_name} 没有需要执行的操作，跳过")
        
        self._log_info(f"SQL生成完成，共 {len(sql_statements)} 张表")
        return sql_statements
    
    def _generate_table_transfer_sql(self, src_conn, src_db, tgt_conn, tgt_db, table_name, operations, compare_result=None):
        """生成单表传输SQL语句"""
        sql_list = []
        
        tgt_conn_obj, tgt_type = self._get_conn(tgt_conn)
        columns = self.get_column_names(src_conn, src_db, table_name)
        
        if not columns:
            self._log_error(f"无法获取表 {table_name} 的列信息")
            return sql_list
        
        pk_cols = self.get_primary_keys(src_conn, src_db, table_name)
        pk_column = pk_cols[0] if pk_cols else columns[0] if columns else 'id'
        
        insert_op = operations.get('insert', False)
        update_op = operations.get('update', False)
        delete_op = operations.get('delete', False)
        
        insert_count = compare_result.get('insert_count', 0) if compare_result else 0
        update_count = compare_result.get('update_count', 0) if compare_result else 0
        delete_count = compare_result.get('delete_count', 0) if compare_result else 0
        
        need_pk = (insert_op and insert_count > 0) or (update_op and update_count > 0) or (delete_op and delete_count > 0)
        src_pk_set = None
        tgt_pk_set = None
        if need_pk:
            BATCH_SIZE = 5000
            src_pk_set = self._fetch_pk_values(src_conn, src_db, table_name, pk_cols, BATCH_SIZE)
            tgt_pk_set = self._fetch_pk_values(tgt_conn, tgt_db, table_name, pk_cols, BATCH_SIZE)
        
        cols_str = ""
        if tgt_type in ('MySQL', 'MariaDB'):
            cols_str = ", ".join(f"`{col}`" for col in columns)
        elif tgt_type == 'PostgreSQL':
            cols_str = ", ".join(f'"{col}"' for col in columns)
        elif tgt_type == 'SQL Server':
            cols_str = ", ".join(f"[{col}]" for col in columns)
        
        def escape_val(val):
            if val is None:
                return 'NULL'
            if isinstance(val, str):
                escaped = val.replace("'", "''")
                return f"'{escaped}'"
            if isinstance(val, (int, float)):
                return str(val)
            if isinstance(val, bool):
                return '1' if val else '0'
            return f"'{str(val)}'"
        
        def pk_condition(pk_tuple):
            if len(pk_cols) == 1:
                return f"`{pk_cols[0]}` = {escape_val(pk_tuple[0])}"
            parts = [f"`{pk_cols[i]}` = {escape_val(pk_tuple[i])}" for i in range(len(pk_cols))]
            return " AND ".join(parts)
        
        def safe_fetch_detail(pk_list, label):
            if not pk_list:
                return
            src_conn_obj, src_type = self._get_conn(src_conn)
            if not src_conn_obj:
                return
            try:
                conds = [pk_condition(pk_val) for pk_val in pk_list]
                sql = f"SELECT {cols_str} FROM `{table_name}` WHERE {' OR '.join(conds)}"
                with src_conn_obj.cursor() as cur:
                    cur.execute(f"USE `{src_db}`")
                    cur.execute(sql)
                    return cur.fetchall()
            except Exception as e:
                self._log_error(f"获取{label}明细失败 {table_name}: {e}")
                return None
            finally:
                self.pool.release_connection(src_conn)
        
        try:
            if insert_op:
                sql_list.append(f"-- ========== 新增数据 ({insert_count} 行) ==========")
                if insert_count > 0 and src_pk_set is not None and tgt_pk_set is not None:
                    insert_pks = list(src_pk_set - tgt_pk_set)[:min(insert_count, 5)]
                    if insert_pks:
                        rows = safe_fetch_detail(insert_pks, "新增")
                        if rows:
                            for row in rows:
                                vals = ", ".join(escape_val(row.get(col)) for col in columns)
                                sql_list.append(f"INSERT INTO `{table_name}` ({cols_str}) VALUES ({vals});")
                        if insert_count > 5:
                            sql_list.append(f"-- ... 还有 {insert_count - 5} 行新增数据")
                    else:
                        sql_list.append(f"-- 无法获取新增数据详情")
                else:
                    sql_list.append(f"-- 没有需要新增的数据")
        except Exception as e:
            self._log_error(f"生成INSERT语句异常 {table_name}: {e}")
            sql_list.append(f"-- 新增数据生成失败: {e}")
        
        try:
            if update_op:
                sql_list.append(f"-- ========== 更新数据 ({update_count} 行) ==========")
                if update_count > 0 and src_pk_set is not None and tgt_pk_set is not None:
                    common_pks = list(src_pk_set & tgt_pk_set)[:min(update_count, 5)]
                    if common_pks:
                        rows = safe_fetch_detail(common_pks, "更新")
                        if rows:
                            for row in rows:
                                set_parts = []
                                pk_val_display = None
                                for col in columns:
                                    val = row.get(col)
                                    if col == pk_column:
                                        pk_val_display = escape_val(val)
                                    else:
                                        set_parts.append(f"`{col}` = {escape_val(val)}")
                                if pk_val_display is not None and set_parts:
                                    sql_list.append(f"UPDATE `{table_name}` SET {', '.join(set_parts)} WHERE `{pk_column}` = {pk_val_display};")
                        if update_count > 5:
                            sql_list.append(f"-- ... 还有 {update_count - 5} 行更新数据")
                    else:
                        sql_list.append(f"-- 无法获取更新数据详情")
                else:
                    sql_list.append(f"-- 没有需要更新的数据")
        except Exception as e:
            self._log_error(f"生成UPDATE语句异常 {table_name}: {e}")
            sql_list.append(f"-- 更新数据生成失败: {e}")
        
        try:
            if delete_op:
                sql_list.append(f"-- ========== 删除数据 ({delete_count} 行) ==========")
                if delete_count > 0 and src_pk_set is not None and tgt_pk_set is not None:
                    delete_pk_list = list(tgt_pk_set - src_pk_set)[:min(delete_count, 5)]
                    if delete_pk_list:
                        for pk_val in delete_pk_list:
                            sql_list.append(f"DELETE FROM `{table_name}` WHERE {pk_condition(pk_val)};")
                        if delete_count > 5:
                            sql_list.append(f"-- ... 还有 {delete_count - 5} 行删除数据")
                    else:
                        sql_list.append(f"-- 无法获取删除数据详情")
                else:
                    sql_list.append(f"-- 没有需要删除的数据")
        except Exception as e:
            self._log_error(f"生成DELETE语句异常 {table_name}: {e}")
            sql_list.append(f"-- 删除数据生成失败: {e}")
        
        return sql_list
    
    def get_table_row_count(self, conn_name, db_name, table_name):
        """获取表行数"""
        conn, conn_type = self._get_conn(conn_name)
        if not conn:
            return 0
        
        try:
            cursor = conn.cursor()
            if conn_type in ('MySQL', 'MariaDB'):
                cursor.execute(f"USE `{db_name}`")
                cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`")
            elif conn_type == 'PostgreSQL':
                cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            elif conn_type == 'SQL Server':
                cursor.execute(f"USE [{db_name}]")
                cursor.execute(f'SELECT COUNT(*) FROM [{table_name}]')
            
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception as e:
            self._log_error(f"获取表行数失败 {table_name}: {e}")
            return 0
    
    def transfer_tables(self, src_conn, src_db, tgt_conn, tgt_db, tables, on_progress=None, **kwargs):
        """传输表数据（简化版）"""
        operations = kwargs.get('operations')
        self._log_info(f"========== 开始传输表数据 ==========")
        self._log_info(f"源连接: {src_conn}/{src_db}")
        self._log_info(f"目标连接: {tgt_conn}/{tgt_db}")
        self._log_info(f"待传输表数量: {len(tables)}")
        self._log_info(f"操作配置: {operations if operations else '默认(全部执行)'}")
        self._log_info(f"所有 kwargs: {kwargs}")
        
        results = {
            'success': 0,
            'failed': 0,
            'total_rows': 0,
            'errors': [],
        }
        
        # 创建操作配置映射
        op_map = {}
        if operations:
            self._log_info("构建操作配置映射...")
            for op in operations:
                op_map[op['table']] = op
                self._log_info(f"  表 {op['table']}: insert={op.get('insert')}, update={op.get('update')}, delete={op.get('delete')}")
        
        self._log_info(f"开始遍历 {len(tables)} 张表...")
        
        for idx, table_name in enumerate(tables):
            self._log_info(f"--- [{idx+1}/{len(tables)}] 处理表: {table_name} ---")
            
            if on_progress:
                on_progress(table_name, "开始")
            
            try:
                # 获取该表的操作配置
                table_op = op_map.get(table_name, {'insert': True, 'update': True, 'delete': True})
                self._log_info(f"操作配置: insert={table_op.get('insert')}, update={table_op.get('update')}, delete={table_op.get('delete')}")
                
                self._transfer_single_table(src_conn, src_db, tgt_conn, tgt_db, table_name, table_op)
                results['success'] += 1
                self._log_info(f"表 {table_name} 传输成功")
                
                if on_progress:
                    on_progress(table_name, "完成")
            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"{table_name}: {e}")
                self._log_error(f"传输表失败 {table_name}: {e}")
                
                if on_progress:
                    on_progress(table_name, "失败")
        
        self._log_info(f"========== 表传输完成 ==========")
        self._log_info(f"成功: {results['success']} 张, 失败: {results['failed']} 张")
        return results
    
    def _transfer_single_table(self, src_conn, src_db, tgt_conn, tgt_db, table_name, operations=None):
        """传输单张表数据（优化版：使用批量插入）"""
        self._log_info(f"-------- _transfer_single_table 开始 --------")
        self._log_info(f"表名: {table_name}")
        self._log_info(f"源: {src_conn}/{src_db}")
        self._log_info(f"目标: {tgt_conn}/{tgt_db}")
        
        # 默认执行所有操作
        if operations is None:
            operations = {'insert': True, 'update': True, 'delete': True}
            self._log_info(f"操作配置: 使用默认值 - insert=True, update=True, delete=True")
        else:
            self._log_info(f"操作配置: insert={operations.get('insert')}, update={operations.get('update')}, delete={operations.get('delete')}")
        
        columns = self.get_column_names(src_conn, src_db, table_name)
        if not columns:
            self._log_error(f"无法获取表 {table_name} 的列信息")
            raise ValueError(f"无法获取表 {table_name} 的列信息")
        self._log_info(f"获取到 {len(columns)} 列: {columns[:5]}...")  # 只显示前5列
        
        self._log_info("获取数据库连接...")
        src_conn_obj, src_type = self._get_conn(src_conn)
        tgt_conn_obj, tgt_type = self._get_conn(tgt_conn)
        
        if not src_conn_obj:
            self._log_error("无法连接源数据库")
            raise ValueError("无法连接源数据库")
        if not tgt_conn_obj:
            self._log_error("无法连接目标数据库")
            raise ValueError("无法连接目标数据库")
        self._log_info(f"源数据库类型: {src_type}, 目标数据库类型: {tgt_type}")
        
        try:
            # 只在需要删除或重新插入时清空目标表
            if operations.get('delete', True) or operations.get('insert', True):
                self._log_info(f"需要清空目标表 {table_name} (delete={operations.get('delete')}, insert={operations.get('insert')})")
                if tgt_type in ('MySQL', 'MariaDB'):
                    with tgt_conn_obj.cursor() as tgt_cur:
                        tgt_cur.execute(f"USE `{tgt_db}`")
                        tgt_cur.execute(f"TRUNCATE TABLE `{table_name}`")
                elif tgt_type == 'PostgreSQL':
                    with tgt_conn_obj.cursor() as tgt_cur:
                        tgt_cur.execute(f'TRUNCATE TABLE "{table_name}"')
                elif tgt_type == 'SQL Server':
                    with tgt_conn_obj.cursor() as tgt_cur:
                        tgt_cur.execute(f"USE [{tgt_db}]")
                        tgt_cur.execute(f'TRUNCATE TABLE [{table_name}]')
                self._log_info(f"目标表 {table_name} 已清空")
            else:
                self._log_info(f"不需要清空目标表 {table_name}")
            
            # 如果不需要插入操作，直接返回
            if not operations.get('insert', True):
                self._log_info(f"跳过插入操作 (insert={operations.get('insert')})")
                self._log_info(f"-------- _transfer_single_table 结束 (跳过) --------")
                return
            self._log_info(f"执行插入操作 (insert={operations.get('insert')})")
            
            # 构建批量插入语句
            BATCH_SIZE = 1000
            
            if tgt_type in ('MySQL', 'MariaDB'):
                cols_str = ", ".join(f"`{col}`" for col in columns)
                placeholders = ", ".join(["%s"] * len(columns))
                insert_sql = f"INSERT INTO `{table_name}` ({cols_str}) VALUES ({placeholders})"
            elif tgt_type == 'PostgreSQL':
                cols_str = ", ".join(f'"{col}"' for col in columns)
                placeholders = ", ".join(["%s"] * len(columns))
                insert_sql = f'INSERT INTO "{table_name}" ({cols_str}) VALUES ({placeholders})'
            elif tgt_type == 'SQL Server':
                cols_str = ", ".join(f"[{col}]" for col in columns)
                placeholders = ", ".join(["%s"] * len(columns))
                insert_sql = f'INSERT INTO [{table_name}] ({cols_str}) VALUES ({placeholders})'
            
            # 禁用自动提交，使用批量插入
            if tgt_type in ('MySQL', 'MariaDB', 'PostgreSQL'):
                tgt_conn_obj.autocommit = False
            
            total_rows = 0
            offset = 0
            
            while True:
                # 分页获取源数据
                src_rows = []
                if src_type in ('MySQL', 'MariaDB'):
                    with src_conn_obj.cursor() as src_cur:
                        src_cur.execute(f"USE `{src_db}`")
                        src_cur.execute(f"SELECT * FROM `{table_name}` LIMIT {offset}, {BATCH_SIZE}")
                        src_rows = src_cur.fetchall()
                elif src_type == 'PostgreSQL':
                    with src_conn_obj.cursor() as src_cur:
                        src_cur.execute(f'SELECT * FROM "{table_name}" OFFSET {offset} LIMIT {BATCH_SIZE}')
                        src_rows = src_cur.fetchall()
                elif src_type == 'SQL Server':
                    with src_conn_obj.cursor() as src_cur:
                        src_cur.execute(f"USE [{src_db}]")
                        src_cur.execute(f"""
                            SELECT * FROM (
                                SELECT *, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS rn
                                FROM [{table_name}]
                            ) AS t WHERE rn > {offset} AND rn <= {offset + BATCH_SIZE}
                        """)
                        src_rows = src_cur.fetchall()
                
                if not src_rows:
                    break
                
                # 批量插入
                with tgt_conn_obj.cursor() as tgt_cur:
                    if tgt_type in ('MySQL', 'MariaDB'):
                        tgt_cur.execute(f"USE `{tgt_db}`")
                    elif tgt_type == 'SQL Server':
                        tgt_cur.execute(f"USE [{tgt_db}]")
                    
                    # 使用 executemany 批量插入
                    values = []
                    for row in src_rows:
                        if isinstance(row, dict):
                            vals = tuple(row.get(col) for col in columns)
                        else:
                            vals = row
                        values.append(vals)
                    
                    tgt_cur.executemany(insert_sql, values)
                
                total_rows += len(src_rows)
                offset += BATCH_SIZE
            
            # 提交事务
            if tgt_type in ('MySQL', 'MariaDB', 'PostgreSQL'):
                self._log_info("提交事务...")
                tgt_conn_obj.commit()
                self._log_info("事务提交成功")
            
            self._log_info(f"表 {table_name} 传输完成，共 {total_rows} 行")
            self._log_info(f"-------- _transfer_single_table 结束 (成功) --------")
            
        finally:
            self.pool.release_connection(src_conn)
            self.pool.release_connection(tgt_conn)
    
    def preview_table(self, conn_name, db_name, table_name, limit=100):
        """预览表数据"""
        self._log_info(f"预览表: {conn_name}/{db_name}.{table_name}")
        
        try:
            cols = self.get_column_names(conn_name, db_name, table_name)
            if not cols:
                self._log_warning(f"无法获取表 {table_name} 的列信息")
                return []
            
            rows, _ = self.fetch_table_rows(conn_name, db_name, table_name, cols, limit=limit)
            return rows[:limit]
        except Exception as e:
            self._log_error(f"预览表失败 {table_name}: {e}")
            return []