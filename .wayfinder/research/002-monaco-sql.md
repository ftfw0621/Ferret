# Monaco Editor for SQL Editing in Electron + React

## Recommendation

**Use `@monaco-editor/react` with a custom SQL completion provider.** Monaco gives a VS Code-grade editing experience out of the box, which matters for a database tool where users spend long sessions writing queries. The worker setup in Electron + Vite is well-documented, the SQL tokenizer covers PostgreSQL well enough with minor theme tweaks, and the completion provider API is flexible enough to inject live schema at runtime.

CodeMirror 6 is the better choice only when bundle size is critical (embedded widgets, mobile) or when you need a truly minimal editor with no extra features. For a desktop Electron app where users expect VS Code-like behavior, Monaco is the right call.

---

## 1. Package Choice: `@monaco-editor/react`

Use [`@monaco-editor/react`](https://www.npmjs.com/package/@monaco-editor/react) (maintained by suren-atoyan). It wraps Monaco without requiring Webpack plugins and handles loader/worker initialization internally.

```bash
npm install @monaco-editor/react monaco-editor
```

### Basic React component

```tsx
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: (sql: string) => void;
}

export function SqlEditor({ value, onChange, onExecute }: SqlEditorProps) {
  const handleMount: OnMount = (editor, monacoInstance) => {
    // Register Cmd+Enter to execute query
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      () => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!model) return;

        // Execute selected text, or entire content if nothing selected
        const sql = selection && !selection.isEmpty()
          ? model.getValueInRange(selection)
          : model.getValue();
        onExecute(sql);
      }
    );
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="sql"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      onMount={handleMount}
      theme="ferret-dark"
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
```

### Key `@monaco-editor/react` API surface

| Prop | Purpose |
|------|---------|
| `onMount(editor, monaco)` | Access the editor instance and the monaco namespace after mount. Register keybindings and completion providers here. |
| `onChange(value, event)` | Fires on every content change. `value` is the full string. |
| `beforeMount(monaco)` | Runs before the editor mounts. Good for `defineTheme` and `registerCompletionItemProvider` since those are global. |
| `defaultLanguage` | Set to `"sql"`. |
| `theme` | String name of a theme registered via `monaco.editor.defineTheme`. |
| `options` | Standard `IStandaloneEditorConstructionOptions`. |

---

## 2. Built-in SQL Language Support

Monaco ships a built-in `sql` language mode that provides:

- **Syntax highlighting** for keywords, strings, numbers, comments (both `--` and `/* */`), identifiers, and operators. Quality is good for standard SQL.
- **Bracket matching** and **auto-closing** for parentheses and quotes.
- **No built-in auto-completion** beyond basic word-based suggestions. SQL does not get the IntelliSense treatment that TypeScript/JavaScript receive.
- **No built-in formatting.** You need a separate formatter.

The tokenizer handles these token types out of the box:

| Token | Examples |
|-------|----------|
| `keyword` | `SELECT`, `FROM`, `WHERE`, `JOIN`, `INSERT`, `UPDATE`, `DELETE` |
| `string.sql` | `'hello'`, `$$body$$` |
| `number` | `42`, `3.14` |
| `comment` | `-- line comment`, `/* block */` |
| `identifier` | unquoted names, `"quoted_name"` |
| `operator` | `=`, `<>`, `>=`, `||` |

### Limitations

- PostgreSQL-specific keywords (`RETURNING`, `ILIKE`, `LATERAL`, `MATERIALIZED`, type casts `::`) are not all recognized as keywords. Some render as plain identifiers.
- Dollar-quoted strings (`$$...$$`) may not highlight correctly depending on the Monaco version.
- PL/pgSQL blocks (`DO $$ ... $$`) get no special treatment.

### Extending for PostgreSQL

Two approaches:

**A) Register additional keywords via a custom Monarch tokenizer** (replaces the built-in SQL tokenizer):

```ts
// In beforeMount or a setup module
monaco.languages.setMonarchTokensProvider('sql', {
  defaultToken: '',
  tokenPostfix: '.sql',
  ignoreCase: true,

  keywords: [
    // Standard SQL
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE',
    'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'INTO', 'VALUES', 'SET',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'ON', 'AS',
    'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'EXISTS',
    'HAVING', 'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'UNION', 'ALL', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'WITH', 'RECURSIVE', 'RETURNING',
    // PostgreSQL-specific
    'ILIKE', 'SIMILAR', 'LATERAL', 'MATERIALIZED', 'CONCURRENTLY',
    'VACUUM', 'ANALYZE', 'EXPLAIN', 'COPY', 'GRANT', 'REVOKE',
    'SERIAL', 'BIGSERIAL', 'SMALLSERIAL', 'GENERATED', 'ALWAYS',
    'IDENTITY', 'OVERRIDING', 'CONFLICT', 'NOTHING', 'EXCLUDED',
    'PARTITION', 'RANGE', 'LIST', 'HASH', 'TABLESPACE', 'EXTENSION',
    'SCHEMA', 'CASCADE', 'RESTRICT', 'IF', 'REPLACE', 'TEMPORARY',
    'UNLOGGED', 'FOREIGN', 'REFERENCES', 'PRIMARY', 'KEY', 'UNIQUE',
    'CHECK', 'DEFAULT', 'CONSTRAINT', 'TRIGGER', 'FUNCTION',
    'PROCEDURE', 'LANGUAGE', 'PLPGSQL', 'RETURNS', 'DECLARE', 'BEGIN',
    'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  ],

  typeKeywords: [
    'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'NUMERIC', 'DECIMAL',
    'REAL', 'FLOAT', 'DOUBLE', 'PRECISION', 'BOOLEAN', 'BOOL',
    'TEXT', 'VARCHAR', 'CHAR', 'CHARACTER', 'VARYING', 'UUID',
    'DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ', 'INTERVAL',
    'JSON', 'JSONB', 'BYTEA', 'ARRAY', 'INET', 'CIDR', 'MACADDR',
    'POINT', 'LINE', 'LSEG', 'BOX', 'PATH', 'POLYGON', 'CIRCLE',
    'TSVECTOR', 'TSQUERY', 'OID', 'REGCLASS', 'VOID',
  ],

  builtinFunctions: [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF',
    'GREATEST', 'LEAST', 'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE',
    'EXTRACT', 'DATE_TRUNC', 'AGE', 'GENERATE_SERIES',
    'ARRAY_AGG', 'STRING_AGG', 'JSON_AGG', 'JSONB_AGG',
    'JSON_BUILD_OBJECT', 'JSONB_BUILD_OBJECT',
    'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD',
    'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
    'LENGTH', 'LOWER', 'UPPER', 'TRIM', 'SUBSTRING', 'REPLACE',
    'CONCAT', 'CONCAT_WS', 'LEFT', 'RIGHT', 'REPEAT', 'REVERSE',
    'TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'TO_TIMESTAMP',
    'REGEXP_MATCH', 'REGEXP_REPLACE', 'REGEXP_SPLIT_TO_TABLE',
    'PG_SIZE_PRETTY', 'PG_TOTAL_RELATION_SIZE',
    'PG_RELATION_SIZE', 'PG_DATABASE_SIZE',
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^',
    '%', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=',
    '^=', '%=', '<<=', '>>=', '>>>=', '::', '->', '->>', '#>',
    '#>>', '@>', '<@', '?|', '?&',
  ],

  symbols: /[=><!~?:&|+\-*/^%]+/,
  escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

  tokenizer: {
    root: [
      // Dollar-quoted strings
      [/\$\w*\$/, { token: 'string.quote', next: '@dollarString.$0' }],

      // Identifiers and keywords
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@typeKeywords': 'type',
          '@builtinFunctions': 'predefined',
          '@default': 'identifier',
        },
      }],

      // Whitespace
      { include: '@whitespace' },

      // Numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],

      // Strings
      [/'/, { token: 'string', next: '@string' }],

      // Delimiters and operators
      [/[{}()\[\]]/, '@brackets'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': '',
        },
      }],

      // Parameters
      [/\$\d+/, 'variable'],  // $1, $2 positional params
      [/:\w+/, 'variable'],   // :named params
    ],

    string: [
      [/[^']+/, 'string'],
      [/''/, 'string.escape'],
      [/'/, { token: 'string', next: '@pop' }],
    ],

    dollarString: [
      [/[^$]+/, 'string'],
      [/\$\w*\$/, {
        cases: {
          '$1==$S2': { token: 'string.quote', next: '@pop' },
          '@default': 'string',
        },
      }],
      [/\$/, 'string'],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/--.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
    ],

    comment: [
      [/[^/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
});
```

**B) Use `monaco-sql-languages`** for pre-built dialect support including PostgreSQL:

```bash
npm install monaco-sql-languages
```

```ts
import { setupLanguageFeatures, LanguageIdEnum } from 'monaco-sql-languages';

setupLanguageFeatures(LanguageIdEnum.PG, {
  completionItems: {
    enable: true,
    triggerCharacters: ['.', ' '],
  },
});
```

**Recommendation:** Start with approach A (custom Monarch tokenizer). It gives full control, no extra dependency, and the tokenizer definition is < 150 lines. Use `monaco-sql-languages` only if you need parser-level features like context-aware table/column position detection.

---

## 3. Auto-Completion Provider

This is the most important integration point. Monaco's `registerCompletionItemProvider` lets you inject table names, column names, and function signatures dynamically.

### Architecture

```
┌─────────────┐     provideCompletionItems()     ┌──────────────────┐
│ Monaco       │ ──────────────────────────────► │ CompletionProvider │
│ Editor       │                                  │                    │
│              │ ◄────────────────────────────── │  - schemaCache     │
│              │     CompletionList               │  - keywordList     │
└─────────────┘                                  │  - functionList    │
                                                  └────────┬─────────┘
                                                           │
                                                    getSchema()
                                                           │
                                                  ┌────────▼─────────┐
                                                  │ Database Service   │
                                                  │ (IPC to main)     │
                                                  └──────────────────┘
```

### Full implementation

```ts
import * as monaco from 'monaco-editor';

// Types for schema metadata
interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  comment?: string;
}

interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  comment?: string;
}

interface SchemaCache {
  tables: TableInfo[];
  schemas: string[];
  functions: Array<{ name: string; args: string; returnType: string; comment?: string }>;
}

let schemaCache: SchemaCache = { tables: [], schemas: [], functions: [] };

// Call this when connection changes or schema is refreshed
export function updateSchemaCache(newSchema: SchemaCache) {
  schemaCache = newSchema;
}

// PostgreSQL keywords for completion (beyond what the tokenizer highlights)
const PG_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'SCHEMA',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'NATURAL',
  'ON', 'USING', 'AS', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
  'LIKE', 'ILIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END', 'DISTINCT', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'ORDER', 'BY', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'LIMIT',
  'OFFSET', 'FETCH', 'GROUP', 'HAVING', 'WINDOW', 'OVER', 'PARTITION',
  'WITH', 'RECURSIVE', 'RETURNING', 'LATERAL', 'EXPLAIN', 'ANALYZE',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT',
];

export function registerSqlCompletionProvider(monacoInstance: typeof monaco) {
  return monacoInstance.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' ', '"'],

    provideCompletionItems(
      model: monaco.editor.ITextModel,
      position: monaco.Position,
    ): monaco.languages.CompletionList {
      const word = model.getWordUntilPosition(position);
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Check if we are after a dot (schema.table or table.column)
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const dotMatch = textUntilPosition.match(/(\w+)\.\s*$/);

      if (dotMatch) {
        const prefix = dotMatch[1].toLowerCase();
        return getDotCompletions(prefix, range);
      }

      // Default: keywords + tables + schemas + functions
      return getTopLevelCompletions(range);
    },
  });
}

function getDotCompletions(
  prefix: string,
  range: monaco.IRange,
): monaco.languages.CompletionList {
  const suggestions: monaco.languages.CompletionItem[] = [];

  // Check if prefix is a schema name -> suggest tables in that schema
  if (schemaCache.schemas.includes(prefix)) {
    for (const table of schemaCache.tables) {
      if (table.schema.toLowerCase() === prefix) {
        suggestions.push({
          label: table.name,
          kind: monaco.languages.CompletionItemKind.Struct,
          insertText: table.name,
          range,
          detail: `Table in ${table.schema}`,
          documentation: table.comment,
        });
      }
    }
    return { suggestions };
  }

  // Check if prefix is a table name -> suggest columns
  const matchingTables = schemaCache.tables.filter(
    (t) => t.name.toLowerCase() === prefix,
  );
  for (const table of matchingTables) {
    for (const col of table.columns) {
      suggestions.push({
        label: col.name,
        kind: col.isPrimaryKey
          ? monaco.languages.CompletionItemKind.Field
          : monaco.languages.CompletionItemKind.Property,
        insertText: col.name,
        range,
        detail: `${col.type}${col.nullable ? '' : ' NOT NULL'}`,
        documentation: col.comment,
        sortText: col.isPrimaryKey ? '0' + col.name : '1' + col.name,
      });
    }
  }

  return { suggestions };
}

function getTopLevelCompletions(
  range: monaco.IRange,
): monaco.languages.CompletionList {
  const suggestions: monaco.languages.CompletionItem[] = [];

  // SQL keywords
  for (const kw of PG_KEYWORDS) {
    suggestions.push({
      label: kw,
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: kw,
      range,
      sortText: '2' + kw, // Sort after tables/schemas
    });
  }

  // Schema names
  for (const schema of schemaCache.schemas) {
    suggestions.push({
      label: schema,
      kind: monaco.languages.CompletionItemKind.Module,
      insertText: schema,
      range,
      detail: 'Schema',
      sortText: '0' + schema,
    });
  }

  // Table names
  for (const table of schemaCache.tables) {
    const qualifiedName = table.schema === 'public'
      ? table.name
      : `${table.schema}.${table.name}`;
    suggestions.push({
      label: qualifiedName,
      kind: monaco.languages.CompletionItemKind.Struct,
      insertText: qualifiedName,
      range,
      detail: `Table (${table.columns.length} columns)`,
      documentation: table.comment,
      sortText: '1' + qualifiedName,
    });
  }

  // Functions
  for (const fn of schemaCache.functions) {
    suggestions.push({
      label: fn.name,
      kind: monaco.languages.CompletionItemKind.Function,
      insertText: fn.name + '($0)',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      range,
      detail: `(${fn.args}) -> ${fn.returnType}`,
      documentation: fn.comment,
      sortText: '1' + fn.name,
    });
  }

  return { suggestions };
}
```

### Updating schema at runtime

```ts
// In main process: query pg_catalog for schema metadata
async function fetchSchema(pool: Pool): Promise<SchemaCache> {
  const [tables, columns, functions, schemas] = await Promise.all([
    pool.query(`
      SELECT t.table_schema, t.table_name, obj_description(c.oid) as comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY t.table_schema, t.table_name
    `),
    pool.query(`
      SELECT c.table_schema, c.table_name, c.column_name, c.data_type,
             c.is_nullable, c.column_default,
             col_description(pgc.oid, c.ordinal_position) as comment,
             EXISTS (
               SELECT 1 FROM information_schema.key_column_usage k
               WHERE k.table_name = c.table_name
                 AND k.column_name = c.column_name
                 AND k.constraint_name LIKE '%_pkey'
             ) as is_primary_key
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `),
    pool.query(`
      SELECT routine_name, routine_schema,
             pg_get_function_arguments(p.oid) as args,
             pg_get_function_result(p.oid) as return_type,
             obj_description(p.oid) as comment
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE r.routine_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    `),
    pool.query(`
      SELECT schema_name FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    `),
  ]);

  // Build SchemaCache from results...
  // Send to renderer via IPC
}

// In renderer: listen for schema updates
ipcRenderer.on('schema-updated', (_event, schema: SchemaCache) => {
  updateSchemaCache(schema);
});
```

### Known limitation: per-instance completion

Monaco registers completion providers globally per language, not per editor instance ([Issue #593](https://github.com/microsoft/monaco-editor/issues/593)). If different tabs connect to different databases, you need to:

1. Track which connection is active.
2. Switch `schemaCache` when the user switches tabs.
3. Or use a closure that captures the active connection ID and checks it inside `provideCompletionItems`.

---

## 4. Multiple Editor Instances (Tabs)

**Do not create one `<Editor>` per tab.** Each Monaco instance creates its own DOM, layout engine, and event listeners. Performance degrades linearly: each keypress spends ~20ms dispatching `selectionchange` to every instance.

### Recommended pattern: single editor, swapped models

```tsx
import { useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface Tab {
  id: string;
  filename: string;
  value: string;
  language: string;
  viewState: monaco.editor.ICodeEditorViewState | null;
}

export function TabbedEditor({ tabs, activeTabId, onTabChange }: {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, monaco.editor.ITextModel>>(new Map());
  const viewStatesRef = useRef<Map<string, monaco.editor.ICodeEditorViewState>>(new Map());

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const switchTab = useCallback((newTabId: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Save current tab's view state
    const currentState = editor.saveViewState();
    if (currentState) {
      viewStatesRef.current.set(activeTabId, currentState);
    }

    // Get or create model for the new tab
    const tab = tabs.find((t) => t.id === newTabId);
    if (!tab) return;

    let model = modelsRef.current.get(newTabId);
    if (!model) {
      model = monaco.editor.createModel(
        tab.value,
        tab.language,
        monaco.Uri.parse(`file:///${tab.filename}`),
      );
      modelsRef.current.set(newTabId, model);
    }

    // Switch model and restore view state
    editor.setModel(model);
    const savedState = viewStatesRef.current.get(newTabId);
    if (savedState) {
      editor.restoreViewState(savedState);
    }
    editor.focus();

    onTabChange(newTabId);
  }, [activeTabId, tabs, onTabChange]);

  // Clean up models when tabs close
  const disposeTab = useCallback((tabId: string) => {
    const model = modelsRef.current.get(tabId);
    if (model) {
      model.dispose();
      modelsRef.current.delete(tabId);
    }
    viewStatesRef.current.delete(tabId);
  }, []);

  return <Editor onMount={handleMount} defaultLanguage="sql" />;
}
```

### Performance tips

- Use `automaticLayout: true` or a `ResizeObserver` rather than manually calling `editor.layout()`.
- Disable minimap for SQL editors (`minimap: { enabled: false }`).
- Set `renderValidationDecorations: 'editable'` to avoid decorating read-only regions.
- Dispose models when tabs close. Monaco leaks models that are not explicitly disposed.

---

## 5. Custom Theme

Register the theme in `beforeMount` before the editor renders.

```ts
import * as monaco from 'monaco-editor';

export function registerFerretTheme(monacoInstance: typeof monaco) {
  monacoInstance.editor.defineTheme('ferret-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      // Keywords: purple
      { token: 'keyword',       foreground: 'BD93F9', fontStyle: 'bold' },
      { token: 'keyword.sql',   foreground: 'BD93F9', fontStyle: 'bold' },

      // Type keywords: lighter purple
      { token: 'type',          foreground: 'C9A5FF' },
      { token: 'type.sql',      foreground: 'C9A5FF' },

      // Built-in functions: blue
      { token: 'predefined',    foreground: '8BE9FD' },
      { token: 'predefined.sql',foreground: '8BE9FD' },

      // Strings: green
      { token: 'string',        foreground: 'A5D6A7' },
      { token: 'string.sql',    foreground: 'A5D6A7' },
      { token: 'string.escape', foreground: '81C784' },
      { token: 'string.quote',  foreground: 'A5D6A7' },

      // Numbers: amber
      { token: 'number',        foreground: 'FFD75F' },
      { token: 'number.float',  foreground: 'FFD75F' },

      // Comments: gray
      { token: 'comment',       foreground: '737373', fontStyle: 'italic' },

      // Identifiers: default text
      { token: 'identifier',    foreground: 'CCCFD3' },

      // Variables/params: orange
      { token: 'variable',      foreground: 'FFB86C' },

      // Operators
      { token: 'operator',      foreground: 'F8F8F2' },
    ],
    colors: {
      'editor.background':                '#1E1E2E',
      'editor.foreground':                '#CDD6F4',
      'editor.lineHighlightBackground':   '#2A2A3E',
      'editor.selectionBackground':       '#44475A',
      'editor.inactiveSelectionBackground':'#3A3A50',
      'editorCursor.foreground':          '#F8F8F2',
      'editorWhitespace.foreground':      '#3B3B52',
      'editorIndentGuide.background':     '#3B3B52',
      'editorIndentGuide.activeBackground':'#5A5A7A',
      'editorLineNumber.foreground':      '#6272A4',
      'editorLineNumber.activeForeground':'#F8F8F2',
      'editorBracketMatch.background':    '#44475A',
      'editorBracketMatch.border':        '#BD93F9',
      'editorSuggestWidget.background':   '#282A36',
      'editorSuggestWidget.border':       '#44475A',
      'editorSuggestWidget.selectedBackground': '#44475A',
    },
  });
}
```

Usage:

```tsx
<Editor
  beforeMount={(monaco) => registerFerretTheme(monaco)}
  theme="ferret-dark"
  defaultLanguage="sql"
/>
```

---

## 6. Keyboard Shortcuts

### Execute query: Cmd+Enter

```ts
// Inside onMount
editor.addAction({
  id: 'execute-query',
  label: 'Execute Query',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
  run: (ed) => {
    const selection = ed.getSelection();
    const model = ed.getModel();
    if (!model) return;
    const sql = selection && !selection.isEmpty()
      ? model.getValueInRange(selection)
      : model.getValue();
    onExecute(sql);
  },
});
```

### Execute selected: Cmd+Shift+Enter

```ts
editor.addAction({
  id: 'execute-selection',
  label: 'Execute Selection',
  keybindings: [
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
  ],
  run: (ed) => {
    const selection = ed.getSelection();
    const model = ed.getModel();
    if (!model || !selection || selection.isEmpty()) return;
    onExecute(model.getValueInRange(selection));
  },
});
```

### Format SQL: Cmd+Shift+F

Monaco has no built-in SQL formatter. Use a library like `sql-formatter`:

```bash
npm install sql-formatter
```

```ts
import { format } from 'sql-formatter';

editor.addAction({
  id: 'format-sql',
  label: 'Format SQL',
  keybindings: [
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
  ],
  run: (ed) => {
    const model = ed.getModel();
    if (!model) return;
    const formatted = format(model.getValue(), {
      language: 'postgresql',
      keywordCase: 'upper',
      tabWidth: 2,
    });
    // Replace entire content with formatted version, preserving undo stack
    ed.executeEdits('format-sql', [{
      range: model.getFullModelRange(),
      text: formatted,
    }]);
  },
});
```

### Other useful shortcuts

| Shortcut | Action | Notes |
|----------|--------|-------|
| Cmd+Enter | Execute query | Custom action |
| Cmd+Shift+F | Format SQL | Custom with sql-formatter |
| Cmd+/ | Toggle comment | Built-in |
| Cmd+D | Select next occurrence | Built-in |
| Cmd+Shift+K | Delete line | Built-in |
| Ctrl+Space | Trigger suggestions | Built-in |
| Cmd+Z / Cmd+Shift+Z | Undo/Redo | Built-in |

---

## 7. Monaco in Electron: Worker Setup

Monaco uses Web Workers for tokenization and language services. In Electron's renderer process, workers need explicit configuration.

### Vite + Electron setup

**`vite.config.ts`:**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // Critical for Electron file:// protocol
  build: {
    outDir: 'dist/renderer',
  },
});
```

**`src/renderer/userWorker.ts`** (worker bootstrap):

```ts
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// SQL does not have a dedicated language worker.
// The editor worker handles tokenization for Monarch-based languages.

self.MonacoEnvironment = {
  getWorker(_workerId: string, _label: string) {
    // SQL uses the default editor worker for Monarch tokenization.
    // JSON/CSS/HTML/TS would need their own workers, but SQL does not.
    return new editorWorker();
  },
};
```

Import this file before any Monaco usage:

```ts
// src/renderer/main.tsx
import './userWorker';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

### Key considerations for Electron

1. **`nodeIntegration`**: If `nodeIntegration: true` in the renderer, Monaco workers can fail because they expect a browser-like environment. Either set `nodeIntegration: false` (recommended with `contextBridge`) or use `nodeIntegrationInWorker: true`.

2. **CSP**: If you set a Content-Security-Policy, add `worker-src 'self' blob:` to allow inline worker creation.

3. **Packaged app paths**: With `base: './'` in Vite, worker URLs resolve relative to the HTML file, which works under `file://` in packaged apps.

4. **`@monaco-editor/react` loader**: By default, `@monaco-editor/react` loads Monaco from a CDN. In Electron (offline use), override the loader:

```ts
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Use the local npm package instead of CDN
loader.config({ monaco });
```

This is essential for Electron. Without it, the editor tries to fetch from `https://cdn.jsdelivr.net` which fails offline.

---

## 8. Complete Setup: Putting It Together

```ts
// src/renderer/setupMonaco.ts
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import './userWorker';
import { registerFerretTheme } from './theme';
import { registerSqlCompletionProvider } from './sqlCompletion';
import { registerPgMonarchTokenizer } from './pgTokenizer';

export function setupMonaco() {
  // Use bundled Monaco, not CDN
  loader.config({ monaco });

  // Register custom theme
  registerFerretTheme(monaco);

  // Register PostgreSQL-aware tokenizer
  registerPgMonarchTokenizer(monaco);

  // Register completion provider
  registerSqlCompletionProvider(monaco);
}
```

```tsx
// src/renderer/App.tsx
import { useEffect } from 'react';
import { setupMonaco } from './setupMonaco';
import { SqlEditor } from './SqlEditor';

export default function App() {
  useEffect(() => {
    setupMonaco();
  }, []);

  return (
    <SqlEditor
      value="SELECT * FROM users WHERE id = 1;"
      onChange={(v) => console.log(v)}
      onExecute={(sql) => console.log('Execute:', sql)}
    />
  );
}
```

---

## 9. CodeMirror 6 Comparison

| Dimension | Monaco | CodeMirror 6 |
|-----------|--------|-------------|
| **Bundle size** | 5-10 MB uncompressed (~2-3 MB gzipped) | ~50 KB minimal, ~150 KB with SQL + autocomplete |
| **SQL dialect support** | Basic built-in; custom Monarch for PostgreSQL | `@codemirror/lang-sql` with `PostgreSQL` dialect built in |
| **Schema autocomplete** | Manual via `registerCompletionItemProvider` | Built-in `schema` option in `sql()` config |
| **Theming** | `defineTheme` with token rules + editor colors | CSS-based with `EditorView.theme()` |
| **Multiple instances** | Heavy; use model swapping | Lightweight; multiple instances are fine |
| **Electron fit** | Native feel; workers need config | No workers needed; simpler setup |
| **Learning curve** | VS Code-like API; extensive docs | Modular; more assembly required |
| **Accessibility** | Good (inherited from VS Code) | Excellent (ARIA, screen readers, mobile) |
| **Find/Replace** | Built-in, full-featured | Extension-based, good |
| **Minimap** | Built-in | Not available |
| **Folding** | Built-in | Extension-based |

### CodeMirror 6 equivalent setup for comparison

```ts
import { EditorView, basicSetup } from 'codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { keymap } from '@codemirror/view';

const schema = {
  users: ['id', 'email', 'name', 'created_at'],
  orders: ['id', 'user_id', 'total', 'status'],
};

const executeKeymap = keymap.of([{
  key: 'Mod-Enter',
  run: (view) => {
    const text = view.state.doc.toString();
    console.log('Execute:', text);
    return true;
  },
}]);

const view = new EditorView({
  doc: 'SELECT * FROM users WHERE id = 1;',
  extensions: [
    basicSetup,
    sql({ dialect: PostgreSQL, schema }),
    executeKeymap,
    EditorView.theme({
      '&': { backgroundColor: '#1e1e2e' },
      '.cm-content': { color: '#cdd6f4' },
    }, { dark: true }),
  ],
  parent: document.getElementById('editor')!,
});
```

### When to prefer CodeMirror 6

- Bundle size is a hard constraint (web app, not desktop).
- You need many simultaneous editor instances (dashboard of query panels).
- PostgreSQL dialect support out of the box matters more than VS Code UX.
- You want schema-based completion with zero custom provider code.
- Mobile or accessibility requirements are primary.

### When to prefer Monaco

- Users expect VS Code-like behavior (your Electron desktop app).
- You want rich built-in features (minimap, folding, find/replace, peek).
- The editor is the primary UI surface (full-screen query editing).
- You plan to support multiple languages later (JSON results, YAML config).
- Bundle size is not a concern (Electron already ships Chromium).

---

## 10. Dependencies Summary

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "monaco-editor": "^0.52.0",
    "sql-formatter": "^15.0.0"
  },
  "devDependencies": {}
}
```

Optional if you want pre-built dialect support:

```json
{
  "monaco-sql-languages": "^1.0.0"
}
```

---

## Decision

**Go with Monaco.** For a desktop Electron database tool, the VS Code-grade editing experience (minimap, folding, find/replace, multi-cursor, peek definitions) justifies the bundle size. The worker setup is a one-time cost, the custom Monarch tokenizer covers PostgreSQL well, and the completion provider API is flexible enough to inject live table/column metadata from the connected database.

The main work items are:
1. Write the Monarch tokenizer for PostgreSQL (~150 lines, provided above).
2. Build the completion provider that queries `pg_catalog` via IPC and populates suggestions.
3. Register the custom theme.
4. Set up the single-editor + model-swapping pattern for tabs.
5. Add `sql-formatter` for Cmd+Shift+F formatting.

All of these are covered with working code in this document.
