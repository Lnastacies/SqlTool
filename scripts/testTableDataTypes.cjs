const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const esbuild = require('esbuild')

function loadTypeModel() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sqltool-types-'))
  const output = path.join(root, 'tableDataTypeModel.cjs')
  esbuild.buildSync({
    entryPoints: [path.resolve(
      __dirname,
      '../src/renderer/features/tables/tableDataTypeModel.ts',
    )],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  })
  return {
    model: require(output),
    dispose: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}

function main() {
  const { model, dispose } = loadTypeModel()
  try {
    const mysql = model.parseTableDataType(
      'MySQL',
      'decimal(12,4) unsigned',
    )
    assert.equal(mysql.name, 'DECIMAL')
    assert.equal(mysql.argument, '12')
    assert.equal(mysql.scale, '4')
    assert.equal(mysql.unsigned, true)
    assert.equal(
      model.updateTableDataType(
        'MySQL',
        'VARCHAR(64)',
        { argument: '128' },
      ),
      'VARCHAR(128)',
    )

    const postgres = model.parseTableDataType(
      'PostgreSQL',
      'timestamp(3) without time zone',
    )
    assert.equal(postgres.name, 'timestamp without time zone')
    assert.equal(postgres.argument, '3')
    assert.equal(
      model.formatTableDataType('PostgreSQL', postgres),
      'timestamp(3) without time zone',
    )

    const sqlServer = model.parseTableDataType(
      'SQL Server',
      'nvarchar(max)',
    )
    assert.equal(sqlServer.name, 'nvarchar')
    assert.equal(sqlServer.argument, 'max')
    assert.equal(
      model.validateTableDataType('SQL Server', 'nvarchar(max)'),
      undefined,
    )
    assert.equal(
      model.selectTableDataType('SQL Server', 'nvarchar'),
      'nvarchar(255)',
    )
    assert.equal(
      model.selectTableDataType('PostgreSQL', 'character varying'),
      'character varying(255)',
    )

    const sqlite = model.parseTableDataType('SQLite', 'DECIMAL(10,2)')
    assert.equal(sqlite.argument, '10')
    assert.equal(sqlite.scale, '2')
    assert.equal(
      model.formatTableDataType('SQLite', sqlite),
      'DECIMAL(10,2)',
    )
    assert.equal(
      model.selectTableDataType('SQLite', 'VARCHAR'),
      'VARCHAR(255)',
    )

    assert.equal(
      model.validateTableDataType('MySQL', "ENUM('草稿','启用')"),
      undefined,
    )
    assert.match(
      model.validateTableDataType('MySQL', 'ENUM') || '',
      /必须填写枚举值/,
    )
    console.log('[字段类型测试] 全部通过')
  } finally {
    dispose()
  }
}

main()
