const assert = require('node:assert/strict')
const {
  splitSqlScript,
} = require('../dist/main/database/databaseBackupScriptParser')
const {
  formatObjectDdl,
  stripMySqlDefiner,
} = require('../dist/main/database/databaseBackupSql')

function testMySqlDelimiter() {
  const trigger = formatObjectDdl('MySQL', {
    name: 'audit_insert',
    kind: 'trigger',
    ddl: `
      CREATE DEFINER=\`root\`@\`localhost\` TRIGGER \`audit_insert\`
      BEFORE INSERT ON \`audit\` FOR EACH ROW
      BEGIN
        SET NEW.\`message\` = CONCAT('created;', NEW.\`message\`);
      END
    `,
  }, true)
  const statements = splitSqlScript([
    '-- 类型: MySQL',
    trigger,
    'INSERT INTO `audit` (`message`) VALUES (\'after trigger;\');',
  ].join('\n'))

  assert.equal(statements.length, 2)
  assert.match(statements[0], /CREATE TRIGGER `audit_insert`/)
  assert.doesNotMatch(statements[0], /DELIMITER|DEFINER/)
  assert.match(statements[1], /INSERT INTO `audit`/)
}

function testPostgreSqlDollarQuote() {
  const statements = splitSqlScript(`
    CREATE FUNCTION public.echo_text(value text)
    RETURNS text
    LANGUAGE plpgsql
    AS $body$
    BEGIN
      RETURN value || ';done';
    END;
    $body$;
    SELECT public.echo_text('sample;value');
  `)

  assert.equal(statements.length, 2)
  assert.match(statements[0], /RETURN value \|\| ';done'/)
  assert.match(statements[1], /^SELECT/)
}

function testSqlServerGoAndQuotedContent() {
  const statements = splitSqlScript(`
    CREATE VIEW [dbo].[active_users] AS
    SELECT 'GO;still text' AS [label];
    GO
    INSERT INTO [audit] ([message]) VALUES ('line;one');
    GO
  `)

  assert.equal(statements.length, 2)
  assert.doesNotMatch(statements.join('\n'), /^\s*GO\s*$/m)
  assert.match(statements[0], /GO;still text/)
}

function testSqliteTriggerBlock() {
  const trigger = formatObjectDdl('SQLite', {
    name: 'audit_update',
    kind: 'trigger',
    ddl: `
      CREATE TRIGGER "audit_update" AFTER UPDATE ON "account"
      BEGIN
        INSERT INTO "audit" ("message") VALUES ('first;step');
        UPDATE "stats" SET "count" = "count" + 1;
      END
    `,
  }, false)
  const statements = splitSqlScript(
    `${trigger}\nINSERT INTO "account" VALUES (1, 'next');`,
  )

  assert.equal(statements.length, 2)
  assert.match(statements[0], /INSERT INTO "audit"/)
  assert.match(statements[0], /UPDATE "stats"/)
  assert.doesNotMatch(statements.join('\n'), /SQLTOOL STATEMENT/)
}

function testCommentsAndDefiner() {
  assert.equal(
    splitSqlScript('-- comment only\n/* block only */').length,
    0,
  )
  assert.equal(
    stripMySqlDefiner(
      'CREATE DEFINER=`backup`@`%` VIEW `v` AS SELECT 1',
    ),
    'CREATE VIEW `v` AS SELECT 1',
  )
}

testMySqlDelimiter()
testPostgreSqlDollarQuote()
testSqlServerGoAndQuotedContent()
testSqliteTriggerBlock()
testCommentsAndDefiner()
console.log('[数据库备份解析测试] 全部通过')
