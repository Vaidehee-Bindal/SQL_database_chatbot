import React from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  FileText,
  Info,
  History,
  LineChart,
  Loader2,
  Lock,
  PieChart as PieChartIcon,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Table2,
  UserRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

const CHART_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];
const CHART_TYPES = new Set(["bar", "line", "pie"]);

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
;

async function readApiJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();

  if (!contentType.includes("application/json")) {
    throw new Error(`Backend did not return JSON. Check that the API is running at ${API_URL}.`);
  }

  const data = JSON.parse(bodyText);
  if (!response.ok) {
    throw new Error(data.detail || data.error || response.statusText || "Backend request failed.");
  }
  return data;
}

function isDateLikeValue(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Date.parse(trimmed)) && /[-/:T]/.test(trimmed);
}

function isNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "bigint") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Number(trimmed));
}

function isIdentifierLikeKey(key) {
  return /(^id$|_id$|^id_|.*_id$|uuid|guid)$/i.test(key);
}

function scoreMetricKey(key, questionText) {
  const normalized = key.toLowerCase();
  let score = 0;

  if (/count|total|sum|revenue|amount|salary|price|cost|profit|value|score|balance|avg|average|min|max|quantity|qty|duration|time|duration/.test(normalized)) {
    score += 4;
  }
  if (new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(questionText)) {
    score += 6;
  }
  if (isIdentifierLikeKey(key)) {
    score -= 6;
  }
  if (/email|name|title|description|department|date|month|year|day|category|type|status|city|country|role|team/i.test(normalized)) {
    score -= 2;
  }

  return score;
}

function scoreLabelKey(key, questionText) {
  const normalized = key.toLowerCase();
  let score = 0;

  if (/name|title|department|category|type|status|city|country|role|team|month|day|year|date|created|joined|order|product|customer|employee/i.test(normalized)) {
    score += 4;
  }
  if (isIdentifierLikeKey(key)) {
    score -= 4;
  }
  if (/email|url|phone|address|description|notes|comment/i.test(normalized)) {
    score -= 2;
  }
  if (/trend|time|month|day|week|year|date|over time|timeline/.test(questionText) && /date|time|month|day|year|created|joined|order/i.test(normalized)) {
    score += 4;
  }

  return score;
}

function inferVisualization(response) {
  const rows = response?.rows || [];
  const columns = response?.columns || [];
  const requestedVisualization = response?.visualization || { type: "table" };

  if (!rows.length) {
    return { ...requestedVisualization, type: requestedVisualization.type || "table" };
  }

  const rowKeys = columns.length > 0 ? columns : Object.keys(rows[0] || {});
  const questionText = String(response?.question || "").toLowerCase();

  const stats = rowKeys.map((key) => {
    let nonEmptyCount = 0;
    let numericCount = 0;
    let dateCount = 0;
    const distinctValues = new Set();

    rows.forEach((row) => {
      const value = row?.[key];
      if (value === null || value === undefined || value === "") return;
      nonEmptyCount += 1;
      distinctValues.add(String(value));
      if (isNumericValue(value)) numericCount += 1;
      if (isDateLikeValue(value)) dateCount += 1;
    });

    return { key, nonEmptyCount, numericCount, dateCount, distinctCount: distinctValues.size };
  });

  const numericColumns = stats
    .filter((column) => column.nonEmptyCount > 0 && column.numericCount === column.nonEmptyCount)
    .sort((left, right) => scoreMetricKey(right.key, questionText) - scoreMetricKey(left.key, questionText));
  const dateColumns = stats.filter((column) => column.nonEmptyCount > 0 && column.dateCount === column.nonEmptyCount);
  const categoricalColumns = stats
    .filter((column) => column.nonEmptyCount > 0 && column.numericCount === 0 && column.dateCount === 0)
    .sort((left, right) => scoreLabelKey(right.key, questionText) - scoreLabelKey(left.key, questionText));

  const wantsTrendChart = /trend|timeline|time series|over time|per month|per day|per week|daily|weekly|monthly/.test(questionText);
  const wantsPieChart = /distribution|breakdown|share|percentage|portion|composition|ratio/.test(questionText);

  const visualizeType = CHART_TYPES.has(requestedVisualization.type) ? requestedVisualization.type : null;
  const currentXAxis = requestedVisualization.x_axis;
  const currentYAxis = requestedVisualization.y_axis;
  const currentKeysExist =
    currentXAxis &&
    currentYAxis &&
    rowKeys.includes(currentXAxis) &&
    rowKeys.includes(currentYAxis);

  if (visualizeType && currentKeysExist) {
    return {
      type: visualizeType,
      x_axis: currentXAxis,
      y_axis: currentYAxis,
      title: requestedVisualization.title || response?.question || "Result",
    };
  }

  const labelColumn = (
    (!wantsTrendChart && categoricalColumns[0]) ||
    dateColumns[0] ||
    categoricalColumns[0] ||
    rowKeys.find((key) => !numericColumns.some((column) => column.key === key)) ||
    rowKeys[0] ||
    null
  );
  const metricColumn = numericColumns[0]?.key || rowKeys.find((key) => key !== labelColumn?.key) || null;

  let type = visualizeType;
  if (!type || type === "table") {
    if (dateColumns.some((column) => column.key === labelColumn?.key) || wantsTrendChart) {
      type = "line";
    } else if (wantsPieChart && rows.length <= 8) {
      type = "pie";
    } else {
      type = "bar";
    }
  }

  const chartable = rows.length > 0;

  return {
    type,
    x_axis: chartable ? (labelColumn?.key || "__label") : null,
    y_axis: chartable ? (metricColumn || "__value") : null,
    title: requestedVisualization.title || response?.question || "Result",
  };
}

function normalizeChartRows(rows, visualization) {
  if (!rows.length || visualization.type === "table") return rows;
  return rows.map((row, index) => {
    const nextRow = { ...row };

    nextRow.__label = visualization.x_axis && row[visualization.x_axis] !== undefined
      ? String(row[visualization.x_axis])
      : `Row ${index + 1}`;

    if (visualization.y_axis && row[visualization.y_axis] !== undefined) {
      nextRow.__value = isNumericValue(row[visualization.y_axis]) ? Number(row[visualization.y_axis]) : 1;
    } else {
      nextRow.__value = 1;
    }
    return nextRow;
  });
}

function App() {
  const [connection, setConnection] = React.useState(null);
  const [selectedTables, setSelectedTables] = React.useState([]);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState("Chat");
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  
  const [question, setQuestion] = React.useState("");
  const [schema, setSchema] = React.useState([]);
  const [history, setHistory] = React.useState([]);
  const [response, setResponse] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [viewMode, setViewMode] = React.useState("table"); // "table" | "chart"
  const [savedQueries, setSavedQueries] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sql-chatbot-saved-queries") || "[]");
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    localStorage.setItem("sql-chatbot-saved-queries", JSON.stringify(savedQueries));
  }, [savedQueries]);

  const normalizeQuery = React.useCallback((query) => query.trim().replace(/\s+/g, " "), []);
  const isQuerySaved = React.useCallback(
    (query) => {
      const normalized = normalizeQuery(query);
      return Boolean(normalized) && savedQueries.some((item) => normalizeQuery(item.question) === normalized);
    },
    [normalizeQuery, savedQueries],
  );
  const toggleSavedQuery = React.useCallback((query) => {
    const normalized = normalizeQuery(query);
    if (!normalized) return;
    setSavedQueries((current) => {
      const exists = current.some((item) => normalizeQuery(item.question) === normalized);
      if (exists) {
        return current.filter((item) => normalizeQuery(item.question) !== normalized);
      }
      return [{ question: normalized, saved_at: new Date().toISOString() }, ...current];
    });
  }, [normalizeQuery]);

  React.useEffect(() => {
    if (!connection) return;
    const loadSchema = async () => {
      setIsConnecting(true);
      try {
        const res = connection.mode === "custom"
          ? await fetch(`${API_URL}/get-tables`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ database_url: connection.databaseUrl }),
            })
          : await fetch(`${API_URL}/schema`);
        const schemaData = await readApiJson(res);
        setSchema(schemaData);
        setSelectedTables(schemaData.map(t => `${t.schema_name}.${t.table_name}`));
      } catch (err) {
        setError(err.message);
      } finally {
        setIsConnecting(false);
      }
    };
    loadSchema();
  }, [connection]);

  const useDemoDatabase = React.useCallback(() => {
    setError("");
    setResponse(null);
    setHistory([]);
    setSchema([]);
    setSelectedTables([]);
    setConnection({ mode: "demo", label: "Demo database" });
  }, []);

  const connectCustomDatabase = React.useCallback(async (databaseUrl) => {
    setIsConnecting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/get-tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database_url: databaseUrl }),
      });
      const data = await readApiJson(res);
      setResponse(null);
      setHistory([]);
      setSchema(data);
      setSelectedTables(data.map(t => `${t.schema_name}.${t.table_name}`));
      setConnection({ mode: "custom", label: "Your Supabase database", databaseUrl });
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const resetConnection = React.useCallback(() => {
    setConnection(null);
    setSchema([]);
    setSelectedTables([]);
    setHistory([]);
    setResponse(null);
    setQuestion("");
    setError("");
    setActiveSection("Chat");
    setIsSidebarOpen(false);
  }, []);

  const submitQuery = React.useCallback(async (event) => {
    event?.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setResponse(null);
    try {
      const res = await fetch(`${API_URL}/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          database_url: connection?.mode === "custom" ? connection.databaseUrl : undefined,
          selected_tables: selectedTables,
        }),
      });
      const data = await readApiJson(res);
      const normalizedData = { ...data, visualization: inferVisualization(data) };
      setResponse(normalizedData);
      
      if (normalizedData.error) {
        setError(normalizedData.error);
      } else {
        // Set view mode based on visualization hint
        if (normalizedData.visualization?.type && normalizedData.visualization.type !== "table") {
          setViewMode("chart");
        } else {
          setViewMode("table");
        }

        setHistory(prev => [
          {
            question: normalizedData.question,
            sql: normalizedData.sql,
            row_count: normalizedData.row_count,
            elapsed_ms: normalizedData.elapsed_ms,
            created_at: normalizedData.created_at,
          },
          ...prev,
        ]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connection, question, selectedTables]);

  const tablesCount = schema.length;
  const columnsCount = schema.reduce((sum, table) => sum + table.columns.length, 0);

  const closeSidebar = React.useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const navigateToSection = React.useCallback((section) => {
    setActiveSection(section);
    setIsSidebarOpen(false);
  }, []);

  if (!connection) {
    return (
      <ConnectScreen
        onDemo={useDemoDatabase}
        onConnect={connectCustomDatabase}
        loading={isConnecting}
      />
    );
  }

  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <div className="grid min-h-screen grid-cols-[280px_1fr_320px] max-[1180px]:grid-cols-[240px_1fr] max-[900px]:grid-cols-1">
        <aside className="border-r border-line bg-[#0c111d] p-5 max-[900px]:hidden">
          <SidebarContent
            connection={connection}
            tablesCount={tablesCount}
            columnsCount={columnsCount}
            activeSection={activeSection}
            onNavigate={navigateToSection}
            onNewChat={() => {
              setActiveSection("Chat");
              setResponse(null);
              setQuestion("");
              setError("");
            }}
            onResetConnection={resetConnection}
          />
        </aside>

        <div
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 max-[900px]:block ${
            isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          } min-[901px]:hidden`}
          onClick={closeSidebar}
          aria-hidden="true"
        />

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[290px] border-r border-line bg-[#0c111d] p-5 shadow-2xl transition-transform duration-200 max-[900px]:block min-[901px]:hidden ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-label="Mobile sidebar"
        >
          <SidebarContent
            connection={connection}
            tablesCount={tablesCount}
            columnsCount={columnsCount}
            activeSection={activeSection}
            onNavigate={navigateToSection}
            onNewChat={() => {
              setActiveSection("Chat");
              setResponse(null);
              setQuestion("");
              setError("");
              setIsSidebarOpen(false);
            }}
            onResetConnection={resetConnection}
            onClose={closeSidebar}
          />
        </aside>

        <main className="min-w-0 p-6 max-[900px]:pt-4">
          <div className="mb-4 hidden items-center justify-between max-[900px]:flex">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm text-slate-200"
            >
              <Database size={16} /> Menu
            </button>
            <div className="rounded-md border border-line bg-panel px-3 py-2 text-xs text-slate-400">
              {connection.mode === "demo" ? "Demo" : "Custom"}
            </div>
          </div>

          {activeSection === "Chat" && (
            <ChatView
              selectedTables={selectedTables}
              connection={connection}
              question={question}
              setQuestion={setQuestion}
              submitQuery={submitQuery}
              loading={loading}
              isConnecting={isConnecting}
              response={response}
              error={error}
              viewMode={viewMode}
              setViewMode={setViewMode}
              isQuerySaved={isQuerySaved}
              toggleSavedQuery={toggleSavedQuery}
            />
          )}
          {activeSection === "History" && (
            <HistoryView history={history} onRun={(query) => { setQuestion(query); setActiveSection("Chat"); }} />
          )}
          {activeSection === "Saved Queries" && (
            <SavedQueriesView
              savedQueries={savedQueries}
              onRun={(query) => { setQuestion(query); setActiveSection("Chat"); }}
              onUnsave={toggleSavedQuery}
            />
          )}
          {activeSection === "Datasets" && (
            <DatasetsView
              schema={schema}
              selectedTables={selectedTables}
              setSelectedTables={setSelectedTables}
              loading={isConnecting}
            />
          )}
          {activeSection === "Security" && <SecurityView />}
          {activeSection === "About" && <AboutView />}
        </main>

        <aside className="border-l border-line bg-[#0c111d] p-5 max-[1180px]:col-span-2 max-[900px]:col-span-1 max-[900px]:border-l-0 max-[900px]:border-t">
          <SchemaExplorer schema={schema} loading={isConnecting} />
          <HistoryPanel history={history} />
        </aside>
      </div>
    </div>
  );
}

function SidebarContent({
  connection,
  tablesCount,
  columnsCount,
  activeSection,
  onNavigate,
  onNewChat,
  onResetConnection,
  onClose,
}) {
  return (
    <>
      <div className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-violet text-white shadow-glow">
            <Bot size={26} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">SQL Chatbot</h1>
            <p className="text-sm text-slate-400">Groq powered analyst</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md border border-line text-slate-300 hover:text-white min-[901px]:hidden"
            aria-label="Close sidebar"
          >
            <Plus size={18} className="rotate-45" />
          </button>
        ) : null}
      </div>

      <button onClick={onNewChat} className="mb-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-violet font-medium text-white shadow-glow">
        <Plus size={18} /> New Chat
      </button>

      <nav className="space-y-1 text-sm">
        {[
          [Sparkles, "Chat"],
          [History, "History"],
          [FileText, "Saved Queries"],
          [Database, "Datasets"],
          [ShieldCheck, "Security"],
          [Info, "About"],
        ].map(([Icon, label]) => {
          const active = activeSection === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(label)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                active ? "bg-violet/15 text-violet" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <Icon size={17} /> {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 rounded-lg border border-line bg-panel p-4">
        <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
          Database <ChevronDown size={16} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald" />
          {connection.mode === "demo" ? "Demo Supabase" : "Connected Supabase"}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <Metric label="Tables" value={tablesCount} />
          <Metric label="Columns" value={columnsCount} />
        </div>
        <button onClick={onResetConnection} className="mt-3 w-full rounded-md border border-line px-3 py-2 text-xs text-slate-300 hover:border-violet hover:text-white">
          Change connection
        </button>
      </div>
    </>
  );
}

function AboutView() {
  return (
    <>
      <SectionHeader title="About" description="What this SQL Chatbot does and why it exists." />
      <section className="rounded-lg border border-line bg-panel p-4">
        <h3 className="mb-2 text-lg font-semibold">Overview</h3>
        <p className="mb-4 text-sm text-slate-300">
          This SQL Chatbot helps you query a Postgres (Supabase) database using natural language. It
          translates your questions into safe, SELECT-only SQL, executes them against a demo or your
          Supabase Transaction Pooler URL, and returns results with optional visualizations.
        </p>

        <h4 className="mt-3 mb-2 text-sm font-semibold">Key Features</h4>
        <ul className="mb-4 ml-5 list-disc text-sm text-slate-300">
          <li>Natural language → safe SQL generation with SELECT-only validation.</li>
          <li>Demo database for quick exploration, or connect your own Supabase Transaction Pooler URL.</li>
          <li>Result visualization (table, bar, line, pie) with automatic inference.</li>
          <li>Query history, saved queries, and easy copy-to-clipboard for generated SQL.</li>
        </ul>

        <h4 className="mt-3 mb-2 text-sm font-semibold">Security</h4>
        <p className="mb-2 text-sm text-slate-300">
          The application is designed with security in mind:
        </p>
        <ul className="mb-4 ml-5 list-disc text-sm text-slate-300">
          <li>All SQL executed by the backend is validated to be SELECT-only (no DML or schema changes).</li>
          <li>Your Supabase credentials are not stored in the browser; the Transaction Pooler URL is kept
              in-memory for the session only and sent to the backend solely to fetch schema and run queries.</li>
          <li>Row limits and single-statement enforcement reduce risk of accidental large scans or modifications.</li>
          <li>Server-side secrets (Groq and Supabase keys) remain in backend/.env and are never exposed to the client.</li>
        </ul>

        <h4 className="mt-3 mb-2 text-sm font-semibold">Why this tool is helpful</h4>
        <p className="text-sm text-slate-300">
          This tool lowers the barrier to explore databases by letting non-SQL users ask questions in plain English,
          while still giving developers fast access to generated SQL they can copy and reuse. It accelerates data
          exploration, prototyping, and reporting without exposing direct write access to your database.
        </p>
      </section>
    </>
  );
}

function ConnectScreen({ onDemo, onConnect, loading }) {
  const [databaseUrl, setDatabaseUrl] = React.useState("");
  const [error, setError] = React.useState("");

  async function submitConnection(event) {
    event.preventDefault();
    setError("");
    try {
      await onConnect(databaseUrl.trim());
    } catch (err) {
      setError(err.message || "Could not connect to Supabase.");
    }
  }

  return (
    <div className="min-h-screen bg-ink p-6 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-5xl items-center">
        <div className="grid w-full grid-cols-[1fr_1.1fr] gap-6 max-[900px]:grid-cols-1">
          <section className="flex flex-col justify-center">
            <div className="mb-6 grid h-14 w-14 place-items-center rounded-xl bg-violet text-white shadow-glow">
              <Bot size={30} />
            </div>
            <h1 className="text-4xl font-semibold tracking-normal">SQL Chatbot</h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-slate-400">
              Connect a Supabase database for this browser session, or try the demo database first. Your database URL is never saved by the app.
            </p>
            <div className="mt-6 rounded-lg border border-emerald/20 bg-emerald/10 p-4">
              <div className="mb-2 flex items-center gap-2 font-medium text-emerald-300">
                <Lock size={18} /> Secure session handling
              </div>
              <p className="text-sm leading-6 text-slate-400">
                Custom Supabase URLs stay in memory only, are sent to the backend only for schema/query requests, and are cleared when you change connection or reload.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-panel p-5 shadow-panel">
            <h2 className="text-xl font-semibold">Choose a database</h2>
            <p className="mt-1 text-sm text-slate-400">Start with demo data or connect your own Supabase Postgres URL.</p>

            <button
              onClick={onDemo}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-between rounded-lg border border-violet/30 bg-violet/10 p-4 text-left transition-colors hover:bg-violet/15 disabled:opacity-60"
            >
              <span>
                <span className="block font-medium text-violet-100">View demo with sample database</span>
                <span className="mt-1 block text-sm text-slate-400">Use the hosted demo connection and try queries immediately.</span>
              </span>
              <Database className="text-violet-300" size={22} />
            </button>

            <div className="my-5 flex items-center gap-3 text-xs uppercase text-slate-500">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={submitConnection} className="space-y-3">
              <label className="block text-sm font-medium text-slate-200">Enter your Supabase Transaction Pooler URL here (Ensure RLS is disabled)</label>
              <textarea
                  value={databaseUrl}
                  onChange={(event) => setDatabaseUrl(event.target.value)}
                  placeholder="postgresql://USERNAME.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?sslmode=require"
                  className="min-h-[118px] w-full resize-none rounded-md border border-line bg-[#0b1020] p-3 text-sm leading-6 text-slate-100 outline-none ring-violet/40 placeholder:text-slate-600 focus:ring-2"
                />
              {error && (
                <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                  <span>{error}</span>
                </div>
              )}
              <button
                disabled={loading || !databaseUrl.trim()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-violet font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                Connect Supabase
              </button>
              <p className="text-xs leading-5 text-slate-500">
                Use a read-only database role for public deployments. The app validates SELECT-only SQL before execution.
              </p>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function ChatView({
  selectedTables,
  connection,
  question,
  setQuestion,
  submitQuery,
  loading,
  isConnecting,
  response,
  error,
  viewMode,
  setViewMode,
  isQuerySaved,
  toggleSavedQuery,
}) {
  const saved = isQuerySaved(question);
  return (
    <>
      <SectionHeader
        title="Query Builder"
        description="Ask questions in natural language and get safe SQL-backed answers."
        action={
          <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-2 text-sm text-slate-300">
            <Database size={17} />
            <span className="max-w-xs truncate">{connection.mode === "demo" ? "Demo" : "Custom"} · {selectedTables.length} table{selectedTables.length !== 1 ? "s" : ""} active</span>
            <span className="h-2 w-2 rounded-full bg-emerald" />
          </div>
        }
      />

      <section className="rounded-lg border border-line bg-panel p-5 shadow-panel">
        <div className="mb-5 flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet">
            <UserRound size={22} />
          </div>
          <div className={`rounded-lg bg-white/[0.06] px-4 py-3 text-sm ${question ? "text-slate-200" : "text-slate-500"}`}>
            {question || "Ask a database question."}
          </div>
        </div>

        <form onSubmit={submitQuery} className="flex gap-3">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask another question..."
            className="h-12 min-w-0 flex-1 rounded-md border border-line bg-[#0b1020] px-4 text-sm outline-none ring-violet/40 placeholder:text-slate-500 focus:ring-2"
          />
          <button
            type="button"
            onClick={() => toggleSavedQuery(question)}
            disabled={!question.trim()}
            title={saved ? "Unstar saved query" : "Star this query"}
            className={`grid h-12 w-12 place-items-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              saved
                ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
                : "border-line bg-[#0b1020] text-slate-400 hover:border-amber-400/60 hover:text-amber-300"
            }`}
          >
            <Star size={18} fill={saved ? "currentColor" : "none"} />
          </button>
          <button disabled={loading || isConnecting} className="flex h-12 items-center gap-2 rounded-md bg-violet px-5 font-medium text-white disabled:opacity-60">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            Send
          </button>
        </form>

        {connection?.mode === "demo" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {examples.map((item) => (
              <button key={item} onClick={() => setQuestion(item)} className="rounded-md border border-line px-3 py-2 text-xs text-slate-300 hover:border-violet hover:text-white">
                {item}
              </button>
            ))}
          </div>
        )}
      </section>

      {response?.error_explanation && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 shadow-lg">
          <AlertTriangle className="shrink-0" size={18} />
          <div>
            <p className="mb-1 font-semibold">Natural Language Debugging</p>
            <p className="leading-relaxed opacity-90">{response.error_explanation}</p>
          </div>
        </div>
      )}

      {error && !response?.error_explanation && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="shrink-0" size={18} /> <span>{error}</span>
        </div>
      )}

      <section className="mt-5 grid grid-cols-2 gap-5 max-[1180px]:grid-cols-1">
        <SqlPanel response={response} loading={loading} />
        <QueryInfoPanel response={response} loading={loading} />
      </section>

      <ResultPanel
        response={response}
        loading={loading}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />
    </>
  );
}

function HistoryView({ history, onRun }) {
  return (
    <>
      <SectionHeader title="History" description="Review recent questions and send any of them back to the chat." />
      <section className="rounded-lg border border-line bg-panel p-4">
        {history.length === 0 ? (
          <EmptyState title="No query history yet" description="Run a question from Chat and it will appear here." />
        ) : (
          <div className="space-y-3">
            {history.map((item, index) => (
              <div key={`${item.created_at}-${index}`} className="rounded-md border border-line bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-violet-100">{item.question}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.row_count} rows returned in {item.elapsed_ms}ms</p>
                  </div>
                  <button onClick={() => onRun(item.question)} className="rounded-md border border-line px-3 py-2 text-xs text-slate-300 hover:border-violet hover:text-white">
                    Run again
                  </button>
                </div>
                {item.sql && <pre className="mt-3 overflow-auto rounded-md bg-[#060914] p-3 text-xs text-slate-300"><code>{item.sql}</code></pre>}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SavedQueriesView({ savedQueries, onRun, onUnsave }) {
  return (
    <>
      <SectionHeader title="Saved Queries" description="Only starred chat questions appear here. Unstar a query to remove it." />
      {savedQueries.length === 0 ? (
        <section className="rounded-lg border border-line bg-panel p-4">
          <EmptyState title="No starred queries yet" description="Go to Chat and use the star button beside the question input." />
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
          {savedQueries.map((item) => (
            <div key={item.question} className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-400/10 text-amber-300">
                  <Star size={18} fill="currentColor" />
                </div>
                <button
                  onClick={() => onUnsave(item.question)}
                  title="Unstar and remove"
                  className="rounded-md border border-amber-400/30 p-2 text-amber-300 hover:bg-amber-400/10"
                >
                  <Star size={16} fill="currentColor" />
                </button>
              </div>
              <p className="font-medium text-slate-100">{item.question}</p>
              <p className="mt-2 text-xs text-slate-500">Saved {formatSavedDate(item.saved_at)}</p>
              <button onClick={() => onRun(item.question)} className="mt-4 rounded-md bg-violet px-3 py-2 text-xs font-medium text-white hover:bg-violet/90">
                Load in Chat
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function DatasetsView({ schema, selectedTables, setSelectedTables, loading }) {
  const toggleTable = (tableId) => {
    setSelectedTables((current) =>
      current.includes(tableId) ? current.filter((item) => item !== tableId) : [...current, tableId]
    );
  };

  return (
    <>
      <SectionHeader title="Datasets" description="Choose which tables are available to the SQL assistant." />
      <section className="rounded-lg border border-line bg-panel p-4">
        {loading ? (
          <EmptyState title="Loading schema" description="Reading table metadata from Supabase." />
        ) : schema.length === 0 ? (
          <EmptyState title="No tables found" description="Create tables in the public schema to use them here." />
        ) : (
          <div className="space-y-3">
            {schema.map((table) => {
              const tableId = `${table.schema_name}.${table.table_name}`;
              const checked = selectedTables.includes(tableId);
              return (
                <label key={tableId} className="flex cursor-pointer items-start gap-3 rounded-md border border-line bg-white/[0.03] p-4 hover:border-violet">
                  <input type="checkbox" checked={checked} onChange={() => toggleTable(tableId)} className="mt-1 h-4 w-4 accent-violet" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-violet-100">{tableId}</p>
                      <span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-slate-400">{table.columns.length} columns</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{table.columns.map((column) => column.name).join(", ")}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function SecurityView() {
  const protections = [
    ["SELECT-only validation", "Blocks INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, and REVOKE."],
    ["Single statement execution", "Rejects semicolon chains and SQL comments before database execution."],
    ["Row limit wrapper", "Runs generated SQL inside a backend wrapper with the configured result limit."],
    ["Schema privacy", "Only allowed schemas are sent to Groq, with public as the default."],
    ["Server-side secrets", "Groq and Supabase credentials stay in backend/.env and are never exposed to the browser."],
  ];
  return (
    <>
      <SectionHeader title="Security" description="Read-only controls currently protecting the SQL assistant." />
      <section className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        {protections.map(([title, description]) => (
          <div key={title} className="rounded-lg border border-emerald/20 bg-emerald/10 p-4">
            <div className="mb-2 flex items-center gap-2 font-medium text-emerald-300">
              <ShieldCheck size={18} /> {title}
            </div>
            <p className="text-sm leading-6 text-slate-400">{description}</p>
          </div>
        ))}
      </section>
    </>
  );
}

function SectionHeader({ title, description, action }) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
      {action}
    </header>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-md border border-dashed border-line p-8 text-center">
      <p className="font-medium text-slate-200">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function formatSavedDate(value) {
  if (!value) return "just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function SqlPanel({ response, loading }) {
  const sql = response?.sql || "";
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!sql) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(sql);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = sql;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // swallow — clipboard may be unavailable in some environments
      console.error("Copy failed", err);
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${copied ? "border-emerald/40 bg-emerald/5" : "border-line bg-panel"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Generated SQL</h3>
        <div className="flex items-center gap-2">
          <div aria-live="polite" className="sr-only">{copied ? "Copied to clipboard" : ""}</div>
          <button
            disabled={!sql}
            onClick={handleCopy}
            title={copied ? "Copied" : "Copy SQL to clipboard"}
            className={`rounded-md border p-2 ${sql ? (copied ? "border-emerald text-emerald-300 bg-emerald/10" : "border-line text-slate-300 hover:text-white") : "border-line text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"}`}
          >
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
      <pre className="min-h-[178px] overflow-auto rounded-md bg-[#060914] p-4 text-sm leading-6 text-slate-200 font-mono">
        <code>{loading ? "Generating safe SQL..." : sql}</code>
      </pre>
    </div>
  );
}

function QueryInfoPanel({ response, loading }) {
  const badges = response?.validation?.badges || ["SELECT only", "No DML", "Single statement", "Row limited"];
  return (
    <div className="rounded-lg border border-emerald/25 bg-emerald/10 p-4">
      <div className="mb-4 flex items-center gap-2 font-semibold text-emerald-300">
        <CheckCircle2 size={18} /> Query Info
      </div>
      <p className="mb-4 text-sm text-slate-300">
        {loading ? "Checking generated SQL..." : response?.error ? "Query failed execution." : response ? "Valid query executed successfully." : "Validation badges will update after a query runs."}
      </p>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span key={badge} className="rounded-md bg-emerald/15 px-3 py-1.5 text-xs text-emerald-200">{badge}</span>
        ))}
      </div>
      {response?.explanation && <p className="mt-4 text-sm leading-6 text-slate-300">{response.explanation}</p>}
    </div>
  );
}

function ResultPanel({ response, loading, viewMode, setViewMode }) {
  const columns = response?.columns || [];
  const viz = response?.visualization || { type: "table" };
  const rows = React.useMemo(() => normalizeChartRows(response?.rows || [], viz), [response, viz]);
  const hasChart = rows.length > 0;
  
  if (!response || response.error) {
    return (
      <section className="mt-5 rounded-lg border border-line bg-panel p-4">
        <div className="flex items-center gap-2 font-semibold text-slate-300 mb-4">
          <Table2 size={18} /> Result
        </div>
        <div className="text-center py-8 text-slate-400">
          {response?.error ? "No results due to error" : "Run a query to see results here"}
        </div>
      </section>
    );
  }

  const VerticalTick = ({ x, y, payload }) => (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={6}
        textAnchor="end"
        fill="#94a3b8"
        fontSize={10}
        transform="rotate(-90)"
      >
        {payload.value}
      </text>
    </g>
  );

  const renderChart = () => {
    const data = rows;
    const xKey = "__label";
    const yKey = "__value";
    
    if (data.length === 0) {
      return <div className="text-center py-8 text-slate-400">Visualization data incomplete</div>;
    }

    switch (viz.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey={xKey} 
                stroke="#94a3b8" 
                tick={<VerticalTick />}
                interval={0}
                height={60}
                axisLine={false}
                tickLine={false}
              />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#8b5cf6" }}
              />
              <Bar dataKey={yKey} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "line":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={data} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis 
                dataKey={xKey} 
                stroke="#94a3b8" 
                tick={<VerticalTick />}
                interval={0}
                height={60}
                axisLine={false}
                tickLine={false}
              />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#8b5cf6" }}
              />
              <Line type="monotone" dataKey={yKey} stroke="#8b5cf6" strokeWidth={2} dot={{ fill: "#8b5cf6", r: 4 }} activeDot={{ r: 6 }} />
            </ReLineChart>
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px" }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return <div className="text-center py-8 text-slate-400">Unsupported chart type: {viz.type}</div>;
    }
  };

  return (
    <section className="mt-5 rounded-lg border border-line bg-panel p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-violet-200">
          <Table2 size={18} /> {viz.title || "Result"}
        </div>
        
        <div className="flex items-center gap-2 p-1 bg-ink rounded-lg border border-line">
          <button 
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "table" ? "bg-violet text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Table2 size={14} /> Table
          </button>
          <button 
            onClick={() => setViewMode("chart")}
            disabled={!hasChart}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "chart" ? "bg-violet text-white" : "text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"}`}
          >
            {viz.type === "line" ? <LineChart size={14} /> : viz.type === "pie" ? <PieChartIcon size={14} /> : <BarChart3 size={14} />}
            Chart
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{loading ? "Running query..." : `${response?.row_count ?? rows.length} rows returned`}</span>
          {response?.elapsed_ms !== undefined && <span>{response.elapsed_ms}ms</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-400">No results found</div>
      ) : (
        <div className="min-h-[350px]">
          {viewMode === "table" ? (
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
          ) : hasChart ? (
            <div className="p-4 bg-white/[0.02] rounded-lg border border-line">
              {renderChart()}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-line p-6 text-center text-sm text-slate-400">
              This result does not have enough numeric or time-based data to render a chart.
            </div>
          )}
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
      <div className="max-h-[360px] space-y-3 overflow-auto pr-1 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="animate-spin mr-2" size={18} />
            Loading schema...
          </div>
        ) : schema.length === 0 ? (
          <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-400">No tables found</p>
        ) : (
          schema.map((table) => (
            <div key={`${table.schema_name}.${table.table_name}`} className="rounded-md bg-white/[0.03] p-3 border border-white/5">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span className="text-violet-200">{table.schema_name}.{table.table_name}</span>
                <span className="rounded-full bg-violet/20 px-2 py-0.5 text-xs text-violet-200">{table.columns.length}</span>
              </div>
              <div className="space-y-1">
                {table.columns.map((column) => (
                  <div key={column.name} className="flex items-center justify-between text-xs text-slate-400">
                    <span className={column.is_primary_key ? "text-violet-400 font-medium" : ""}>
                      {column.name}{column.is_primary_key ? " (PK)" : ""}
                    </span>
                    <span className="opacity-60">{column.data_type}</span>
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
      <div className="space-y-2 max-h-[300px] overflow-auto custom-scrollbar">
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">Queries will appear here</p>
        ) : (
          history.map((item, idx) => (
            <div key={idx} className="rounded-md bg-white/[0.03] p-3 border border-white/5">
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
    <div className="rounded-md bg-white/[0.04] p-2 border border-white/5">
      <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-200">{value}</div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
