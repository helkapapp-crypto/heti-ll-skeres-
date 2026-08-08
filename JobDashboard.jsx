import React, { useState, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { RefreshCw, Search, ExternalLink, AlertCircle } from "lucide-react";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWTTXyu7aVF9liz6ur0wkaHHst-4V4IjSS6DsS3my0oF-37Zaf1lZImrpk6AV7ETLh9UjfUSVo3WQz/pub?gid=1406022163&single=true&output=csv";

function scoreTone(score) {
  const n = Number(score);
  if (n >= 8) return { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", tag: "bg-emerald-700" };
  if (n >= 5) return { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", tag: "bg-amber-600" };
  return { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-800", tag: "bg-rose-700" };
}

export default function JobDashboard() {
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [errorMsg, setErrorMsg] = useState("");
  const [query, setQuery] = useState("");
  const [lastFetched, setLastFetched] = useState(null);

  const loadData = () => {
    setStatus("loading");
    fetch(CSV_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((csvText) => {
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        const rows = (parsed.data || [])
          .filter((r) => r["Munkakör"])
          .map((r) => ({
            date: r["Dátum"] || "",
            title: r["Munkakör"] || "",
            company: r["Cég"] || "",
            score: Number(r["Pontszám"]) || 0,
            salary: r["Bér"] || "nincs megadva",
            reason: r["Miért illik"] || "",
            link: r["Link"] || "",
            source: r["Forrás"] || "",
          }))
          .sort((a, b) => b.score - a.score);
        setJobs(rows);
        setLastFetched(new Date());
        setStatus("ok");
      })
      .catch((err) => {
        setErrorMsg(String(err.message || err));
        setStatus("error");
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.reason.toLowerCase().includes(q)
    );
  }, [jobs, query]);

  const weekLabel = jobs.length > 0 ? jobs[0].date : "";

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: "#F6F4EE" }}>
      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Header */}
        <div className="border-b-2 pb-4 mb-6" style={{ borderColor: "#1B2430" }}>
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div>
              <p
                className="text-[11px] font-mono uppercase tracking-[0.2em]"
                style={{ color: "#6B6255" }}
              >
                Heti álláskereső · manifest
              </p>
              <h1
                className="text-2xl font-bold tracking-tight mt-1"
                style={{ color: "#1B2430" }}
              >
                Talált pozíciók{weekLabel ? ` — ${weekLabel}` : ""}
              </h1>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide px-3 py-2 border rounded"
              style={{ borderColor: "#1B2430", color: "#1B2430" }}
            >
              <RefreshCw size={13} className={status === "loading" ? "animate-spin" : ""} />
              Frissítés
            </button>
          </div>
          <p className="text-xs font-mono mt-2" style={{ color: "#8A8272" }}>
            {jobs.length} találat · forrás: Google Sheet (automatikus, heti frissítés)
            {lastFetched && ` · lekérve ${lastFetched.toLocaleTimeString("hu-HU")}`}
          </p>
        </div>

        {/* Search */}
        {status === "ok" && (
          <div className="relative mb-5">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "#8A8272" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szűrés munkakör, cég vagy indoklás alapján..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border rounded outline-none"
              style={{ borderColor: "#D8D3C7", backgroundColor: "#FFFFFF", color: "#1B2430" }}
            />
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div className="text-center py-16 font-mono text-sm" style={{ color: "#8A8272" }}>
            Adatok betöltése...
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div
            className="border rounded p-4 flex items-start gap-3"
            style={{ borderColor: "#E4B4B0", backgroundColor: "#FBEDEC" }}
          >
            <AlertCircle size={18} style={{ color: "#B0413E" }} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium" style={{ color: "#7A2E2A" }}>
                Nem sikerült betölteni az adatokat.
              </p>
              <p className="text-xs mt-1 font-mono" style={{ color: "#8A4F4C" }}>
                {errorMsg}
              </p>
            </div>
          </div>
        )}

        {/* Job list */}
        {status === "ok" && (
          <div className="flex flex-col gap-3">
            {filtered.length === 0 && (
              <p className="text-sm text-center py-10 font-mono" style={{ color: "#8A8272" }}>
                Nincs a szűrésnek megfelelő találat.
              </p>
            )}
            {filtered.map((job, i) => {
              const tone = scoreTone(job.score);
              return (
                <div
                  key={i}
                  className={`border rounded-lg p-4 bg-white flex gap-4 ${tone.border}`}
                  style={{ backgroundColor: "#FFFFFF" }}
                >
                  <div
                    className={`shrink-0 w-12 h-12 rounded flex items-center justify-center text-white font-mono font-bold text-sm ${tone.tag}`}
                  >
                    {job.score}/10
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <a
                        href={job.link || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[15px] leading-snug hover:underline flex items-center gap-1"
                        style={{ color: "#1B2430" }}
                      >
                        {job.title}
                        <ExternalLink size={12} style={{ color: "#8A8272" }} />
                      </a>
                    </div>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "#6B6255" }}>
                      {job.company} · {job.source}
                    </p>
                    <p className="text-sm mt-2" style={{ color: "#2E3440" }}>
                      {job.reason}
                    </p>
                    <p
                      className={`text-xs mt-2 inline-block px-2 py-0.5 rounded font-mono ${tone.bg} ${tone.text}`}
                    >
                      {job.salary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] font-mono mt-8" style={{ color: "#B0AA9C" }}>
          Ez a nézet közvetlenül a publikált Google Sheet-ből olvas — minden csütörtöki
          automatikus futás után frissül a tartalma, frissítéskor nem kell semmit kézzel
          átmásolni.
        </p>
      </div>
    </div>
  );
}
