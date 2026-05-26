import React from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Table2,
  UserRound,
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const examples = [
  "Show orders with customer names and emails",
  "Total spent per customer",
  "List customers who have never placed an order",
  "Recent orders with customer details",
  "Show top 5 customers by revenue",
  "Total revenue per month",
  "Orders from last 7 days",
  "Customers with highest orders",
];

function App() {
  // Connection state
  const [selectedTables, setSelectedTables] = React.useState([]);
  const [isConnecting, setIsConnecting] = React.useState(false);
  
  const [question, setQuestion] = React.useState(examples[0]);
  const [schema, setSchema] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [response, setResponse] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Initial load: fetch schema
  React.useEffect(() => {
    const loadSchema = async () => {
      setIsConnecting(true);
      try {
        const res = await fetch(`${API_BASE}/schema`);
        if (!res.ok) throw new Error("Failed to load schema from backend. Check if backend is running and .env is configured.");
        const schemaData = await res.json();
        setSchema(schemaData);
        // Auto-select all tables
        setSelectedTables(schemaData.map(t => `${t.schema_name}.${t.table_name}`));
      } catch (err) {
        setError(err.message);
      } finally {
        setIsConnecting(false);
      }
    };
    loadSchema();
  }, []);

  const submitQuery = React.useCallback(async (event) => {
    event?.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          selected_tables: selectedTables,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      setResponse(data);
      setHistory(prev => [
        {
          question: data.question,
          sql: data.sql,
          row_count: data.row_count,
          elapsed_ms: data.elapsed_ms,
          created_at: data.created_at,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [question, selectedTables]);

  const tablesCount = schema.length;
  const columnsCount = schema.reduce((sum, table) => sum + table.columns.length, 0);

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="grid min-h-screen grid-cols-[280px_1fr_320px] max-[1180px]:grid-cols-[240px_1fr] max-[900px]:grid-cols-1">
        <aside className="border-r border-line bg-[#0c111d] p-5 max-[900px]:hidden">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-violet text-white shadow-glow">
              <Bot size={26} />
            </div>
            <div>
              <h1 className="text-lg font-semibold">SQL Chatbot</h1>
              <p className="text-sm text-slate-400">Groq powered analyst</p>
            </div>
          </div>

          <button className="mb-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-violet font-medium text-white shadow-glow">
            <Plus size={18} /> New Chat
          </button>

          <nav className="space-y-1 text-sm">
            {[
              [Sparkles, "Chat", true],
              [History, "History"],
              [FileText, "Saved Queries"],
              [LayoutDashboard, "Dashboards"],
              [Database, "Datasets"],
              [ShieldCheck, "Security"],
            ].map(([Icon, label, active]) => (
              <a
                key={label}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${
                  active ? "bg-violet/15 text-violet" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
                href="#"
              >
                <Icon size={17} /> {label}
              </a>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-line bg-panel p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
              Database <ChevronDown size={16} />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
              PostgreSQL
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <Metric label="Tables" value={tablesCount} />
              <Metric label="Columns" value={columnsCount} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-emerald/25 bg-emerald/10 p-4 text-sm">
            <div className="mb-3 flex items-center gap-2 font-medium text-emerald-300">
              <Lock size={16} /> Read-only mode
            </div>
            <p className="text-xs leading-5 text-slate-400">SELECT-only validation, statement timeout, and enforced row limits run on the backend.</p>
          </div>
        </aside>

        <main className="min-w-0 p-6">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Query Builder</h2>
              <p className="text-sm text-slate-400">Ask questions in natural language and get safe SQL-backed answers.</p>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-2 text-sm text-slate-300">
              <Database size={17} />
              <span className="truncate max-w-xs">{selectedTables.length} table{selectedTables.length !== 1 ? "s" : ""} active</span>
              <span className="h-2 w-2 rounded-full bg-emerald" />
            </div>
          </header>

          <section className="rounded-lg border border-line bg-panel p-5 shadow-panel">
            <div className="mb-5 flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet">
                <UserRound size={22} />
              </div>
              <div className="rounded-lg bg-white/[0.06] px-4 py-3 text-sm text-slate-200">{question || "Ask a database question..."}</div>
            </div>

            <form onSubmit={submitQuery} className="flex gap-3">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask another question..."
                className="h-12 min-w-0 flex-1 rounded-md border border-line bg-[#0b1020] px-4 text-sm outline-none ring-violet/40 placeholder:text-slate-500 focus:ring-2"
              />
              <button disabled={loading || isConnecting} className="flex h-12 items-center gap-2 rounded-md bg-violet px-5 font-medium text-white disabled:opacity-60">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                Send
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {examples.map((item) => (
                <button key={item} onClick={() => setQuestion(item)} className="rounded-md border border-line px-3 py-2 text-xs text-slate-300 hover:border-violet hover:text-white">
                  {item}
                </button>
              ))}
            </div>
          </section>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} /> <span>{error}</span>
            </div>
          )}

          <section className="mt-5 grid grid-cols-2 gap-5 max-[1180px]:grid-cols-1">
            <SqlPanel response={response} loading={loading} />
            <ValidationPanel response={response} loading={loading} />
          </section>

          <ResultPanel response={response} loading={loading} />
        </main>

        <aside className="border-l border-line bg-[#0c111d] p-5 max-[1180px]:col-span-2 max-[900px]:col-span-1 max-[900px]:border-l-0 max-[900px]:border-t">
          <SchemaExplorer schema={schema} loading={isConnecting} />
          <HistoryPanel history={history} />
        </aside>
      </div>
    </div>
  );
}

function SqlPanel({ response, loading }) {
  const sql = response?.sql || "SELECT customer_id, SUM(amount) AS total_revenue\nFROM orders\nGROUP BY customer_id\nORDER BY total_revenue DESC\nLIMIT 5";
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Generated SQL</h3>
        <button onClick={() => navigator.clipboard?.writeText(sql)} className="rounded-md border border-line p-2 text-slate-300 hover:text-white">
          <Copy size={16} />
        </button>
      </div>
      <pre className="min-h-[178px] overflow-auto rounded-md bg-[#060914] p-4 text-sm leading-6 text-slate-200"><code>{loading ? "Generating safe SQL..." : sql}</code></pre>
    </div>
  );
}

function ValidationPanel({ response, loading }) {
  const badges = response?.validation?.badges || ["SELECT only", "No DML", "Single statement", "Row limited"];
  return (
    <div className="rounded-lg border border-emerald/25 bg-emerald/10 p-4">
      <div className="mb-4 flex items-center gap-2 font-semibold text-emerald-300">
        <CheckCircle2 size={18} /> Query Validation
      </div>
      <p className="mb-4 text-sm text-slate-300">{loading ? "Checking generated SQL..." : response ? "Valid query. Safe to execute in read-only mode." : "Validation badges will update after a query runs."}</p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={badge} className="rounded-md bg-emerald/15 px-3 py-1.5 text-xs text-emerald-200">{badge}</span>
        ))}
      </div>
      {response?.explanation && <p className="mt-4 text-sm leading-6 text-slate-300">{response.explanation}</p>}
    </div>
  );
}

function ResultPanel({ response, loading }) {
  const columns = response?.columns || [];
  const rows = response?.rows || [];
  
  if (!response) {
    return (
      <section className="mt-5 rounded-lg border border-line bg-panel p-4">
        <div className="flex items-center gap-2 font-semibold text-slate-300 mb-4">
          <Table2 size={18} /> Result
        </div>
        <div className="text-center py-8 text-slate-400">
          Run a query to see results here
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 rounded-lg border border-line bg-panel p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-violet-200">
          <Table2 size={18} /> Result
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{loading ? "Running query..." : `${response?.row_count ?? rows.length} rows returned`}</span>
          {response?.elapsed_ms !== undefined && <span>{response.elapsed_ms}ms</span>}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No results found</div>
      ) : (
        <div className="overflow-auto rounded-md border border-line">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase text-slate-400">
              <tr>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-white/[0.03]">
                  {columns.map((column) => <td key={column} className="px-4 py-3 text-slate-300">{String(row[column] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SchemaExplorer({ schema, loading }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Schema</h3>
        <Database size={16} className="text-slate-400" />
      </div>
      <div className="max-h-[360px] space-y-3 overflow-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="animate-spin mr-2" size={18} />
            Loading schema...
          </div>
        ) : schema.length === 0 ? (
          <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-400">No tables found</p>
        ) : (
          schema.map((table) => (
            <div key={`${table.schema_name}.${table.table_name}`} className="rounded-md bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span>{table.schema_name}.{table.table_name}</span>
                <span className="rounded-full bg-violet/20 px-2 py-0.5 text-xs text-violet-200">{table.columns.length}</span>
              </div>
              <div className="space-y-1">
                {table.columns.map((column) => (
                  <div key={column.name} className="flex items-center justify-between text-xs text-slate-400">
                    <span className={column.is_primary_key ? "text-violet-300 font-medium" : ""}>
                      {column.name}{column.is_primary_key ? " (PK)" : ""}
                    </span>
                    <span>{column.data_type}</span>
                  </div>
                ))}
              </div>
              {table.foreign_keys?.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/5">
                  <div className="text-[10px] font-semibold uppercase text-slate-500 mb-1">Relationships</div>
                  {table.foreign_keys.map((fk, idx) => (
                    <div key={idx} className="text-[11px] text-emerald-400/80 leading-relaxed">
                      {fk.column_name} → {fk.foreign_table_name}({fk.foreign_column_name})
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function HistoryPanel({ history }) {
  return (
    <section className="mt-5 rounded-lg border border-line bg-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">History</h3>
        <Clock3 size={16} className="text-slate-400" />
      </div>
      <div className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Queries will appear here</p>
        ) : (
          history.map((item, idx) => (
            <div key={idx} className="rounded-md bg-white/[0.03] p-3">
              <div className="line-clamp-1 text-sm text-violet-200">{item.question}</div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{item.row_count} rows</span>
                <span>{item.elapsed_ms}ms</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md bg-white/[0.04] p-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-200">{value}</div>
    </div>
  );
}

async function readError(res) {
  try {
    const data = await res.json();
    return data.detail || res.statusText;
  } catch {
    return res.statusText;
  }
}

createRoot(document.getElementById("root")).render(<App />);
