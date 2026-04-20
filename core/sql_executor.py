#!/usr/bin/env python3
"""
SQL执行器
"""

import time
import pandas as pd

class SQLExecutor:
    """SQL执行器"""
    def __init__(self, main_window):
        self.main_window = main_window
        self.logger = main_window.logger
    
    def execute_sql(self, sql, connection):
        """执行SQL语句"""
        start_time = time.time()
        result = None
        message = ""
        
        try:
            cursor = connection.cursor()
            
            # 执行SQL
            cursor.execute(sql)
            
            # 获取结果
            if cursor.description:
                # 对于查询语句
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                result = {
                    'columns': columns,
                    'rows': rows,
                    'affected_rows': len(rows)
                }
                message = f"查询成功，返回 {len(rows)} 条记录"
            else:
                # 对于非查询语句
                affected_rows = cursor.rowcount
                result = {
                    'affected_rows': affected_rows
                }
                message = f"执行成功，影响 {affected_rows} 行"
            
            # 提交事务
            connection.commit()
            
        except Exception as e:
            # 回滚事务
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
        try:
            cursor = connection.cursor()
            
            # 对于不同数据库类型，EXPLAIN语法可能不同
            db_type = self.main_window.current_db_type
            if db_type == 'MySQL':
                explain_sql = f"EXPLAIN {sql}"
            elif db_type == 'PostgreSQL':
                explain_sql = f"EXPLAIN ANALYZE {sql}"
            else:
                return "该数据库类型不支持EXPLAIN", False
            
            cursor.execute(explain_sql)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            # 格式化执行计划
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
        # 简单的SQL格式化
        sql = sql.strip()
        if not sql.endswith(';'):
            sql += ';'
        
        # 关键字大写
        keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'DATABASE']
        for keyword in keywords:
            import re
            sql = re.sub(rf'\b{keyword.lower()}\b', keyword, sql, flags=re.IGNORECASE)
        
        # 添加换行
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
            
            # 创建DataFrame
            df = pd.DataFrame(result['rows'], columns=result['columns'])
            
            # 导出到不同格式
            if format == 'csv':
                df.to_csv(file_path, index=False, encoding='utf-8')
            elif format == 'excel':
                df.to_excel(file_path, index=False)
            elif format == 'json':
                df.to_json(file_path, orient='records', force_ascii=False, indent=2)
            elif format == 'sql':
                # 生成INSERT语句
                table_name = 'exported_data'
                sql = f"INSERT INTO {table_name} ({', '.join(result['columns'])}) VALUES\n"
                values = []
                for row in result['rows']:
                    row_values = []
                    for val in row:
                        if val is None:
                            row_values.append('NULL')
                        elif isinstance(val, str):
                            row_values.append(f"'{val.replace("'", "''")}'")
                        else:
                            row_values.append(str(val))
                    values.append(f"({', '.join(row_values)})")
                sql += ',\n'.join(values) + ';'
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(sql)
            
            return True, f"数据已成功导出到 {file_path}"
        
        except Exception as e:
            return False, f"导出失败: {str(e)}"
