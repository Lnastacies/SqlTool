#!/usr/bin/env python3
"""
SQL执行器 - 使用数据库适配器模式重构
"""

import time
import pandas as pd

from core.adapter_factory import AdapterFactory


class SQLExecutor:
    """SQL执行器"""

    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
        self.adapter_factory = AdapterFactory()

    def execute_sql(self, sql, connection):
        """执行SQL语句"""
        start_time = time.time()
        result = None
        message = ""

        try:
            cursor = connection.cursor()

            cursor.execute(sql)

            if cursor.description:
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                result = {
                    'columns': columns,
                    'rows': rows,
                    'affected_rows': len(rows)
                }
                message = f"查询成功，返回 {len(rows)} 条记录"
            else:
                affected_rows = cursor.rowcount
                result = {
                    'affected_rows': affected_rows
                }
                message = f"执行成功，影响 {affected_rows} 行"

            connection.commit()

        except Exception as e:
            connection.rollback()
            message = f"执行失败: {str(e)}"
            self.logger.log('ERROR', message)

        finally:
            if 'cursor' in locals():
                cursor.close()

        execution_time = time.time() - start_time

        return result, message, execution_time

    def explain_sql(self, sql, connection):
        """解释SQL语句"""
        db_type = self.main_window.current_db_type
        adapter = self.adapter_factory.get_adapter(db_type)

        if not adapter:
            return "该数据库类型不支持EXPLAIN", False

        explain_sql = adapter.get_explain_sql(sql)
        if not explain_sql:
            return "该数据库类型不支持EXPLAIN", False

        try:
            cursor = connection.cursor()

            cursor.execute(explain_sql)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()

            plan = ""
            for row in rows:
                plan += '\t'.join([str(col) for col in row]) + '\n'

            return plan, True

        except Exception as e:
            return f"解释失败: {str(e)}", False

        finally:
            if 'cursor' in locals():
                cursor.close()

    def format_sql(self, sql):
        """格式化SQL语句"""
        sql = sql.strip()
        if not sql.endswith(';'):
            sql += ';'

        keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'DATABASE']
        for keyword in keywords:
            import re
            sql = re.sub(rf'\b{keyword.lower()}\b', keyword, sql, flags=re.IGNORECASE)

        sql = sql.replace(' SELECT', '\nSELECT')
        sql = sql.replace(' FROM', '\nFROM')
        sql = sql.replace(' WHERE', '\nWHERE')
        sql = sql.replace(' JOIN', '\nJOIN')
        sql = sql.replace(' GROUP BY', '\nGROUP BY')
        sql = sql.replace(' ORDER BY', '\nORDER BY')
        sql = sql.replace(' LIMIT', '\nLIMIT')
        sql = sql.replace(' OFFSET', '\nOFFSET')
        sql = sql.replace(' INSERT', '\nINSERT')
        sql = sql.replace(' UPDATE', '\nUPDATE')
        sql = sql.replace(' DELETE', '\nDELETE')
        sql = sql.replace(' CREATE', '\nCREATE')
        sql = sql.replace(' ALTER', '\nALTER')
        sql = sql.replace(' DROP', '\nDROP')

        return sql

    def export_data(self, result, format='csv', file_path=''):
        """导出数据"""
        try:
            if not result or 'columns' not in result or 'rows' not in result:
                return False, "没有数据可导出"

            df = pd.DataFrame(result['rows'], columns=result['columns'])

            if format == 'csv':
                df.to_csv(file_path, index=False, encoding='utf-8')
            elif format == 'excel':
                df.to_excel(file_path, index=False)
            elif format == 'json':
                df.to_json(file_path, orient='records', force_ascii=False, indent=2)
            elif format == 'sql':
                table_name = 'exported_data'
                sql = f"INSERT INTO {table_name} ({', '.join(result['columns'])}) VALUES\n"
                values = []
                for row in result['rows']:
                    row_values = []
                    for val in row:
                        if val is None:
                            row_values.append('NULL')
                        elif isinstance(val, str):
                            row_values.append(f"'{val.replace(\"'\", \"''\")}'")
                        else:
                            row_values.append(str(val))
                    values.append(f"({', '.join(row_values)})")
                sql += ',\n'.join(values) + ';'

                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(sql)

            return True, f"数据已成功导出到 {file_path}"

        except Exception as e:
            return False, f"导出失败: {str(e)}"