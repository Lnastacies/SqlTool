const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, fileName) => {
    const source = fs.readFileSync(fileName, 'utf8')
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName,
    }).outputText
    module._compile(output, fileName)
  }
}

const {
  buildTableObjectContextMenu,
} = require('../src/renderer/features/tables/tableObjectContextMenu.tsx')

function visibleItems(items) {
  return items.filter(item => item && item.type !== 'divider')
}

console.log('[表对象右键菜单测试] 开始')
const calls = []
const items = buildTableObjectContextMenu({
  onAction: action => calls.push(action.id),
})
const visible = visibleItems(items)

assert.deepEqual(
  visible.map(item => item.label),
  [
    '打开表',
    '设计表',
    '新建表',
    '删除表',
    '清空表',
    '导入向导',
    '导出向导',
  ],
)
assert.equal(
  visible.find(item => item.key === 'delete')?.danger,
  true,
  '删除表必须显示为危险操作',
)
assert.equal(
  visible.find(item => item.key === 'truncate')?.danger,
  true,
  '清空表必须显示为危险操作',
)
visible.forEach(item => item.onClick())
assert.deepEqual(
  calls,
  ['open', 'design', 'create', 'delete', 'truncate', 'import', 'export'],
)
console.log('[表对象右键菜单测试] 全部通过')
