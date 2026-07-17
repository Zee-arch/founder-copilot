"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ValidationReport } from "@/lib/types";

const STORAGE_KEY = "foundercopilot:report";

type ReportState = {
  idea: string;
  report: ValidationReport | null;
  // False until the initial sessionStorage read finishes — consumers should
  // wait for this before deciding "there's no report" (e.g. redirecting).
  // Combined into one state object with `report` (rather than a separate
  // useState) so there's no intermediate render where isHydrated is true
  // but report hasn't been applied yet — that gap caused a real redirect
  // race on hard page loads.
  isHydrated: boolean;
};

type ReportContextValue = ReportState & {
  setReportData: (idea: string, report: ValidationReport) => void;
  clearReport: () => void;
};

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReportState>({ idea: "", report: null, isHydrated: false });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { idea: string; report: ValidationReport };
        setState({ idea: parsed.idea, report: parsed.report, isHydrated: true });
        return;
      }
    } catch {
      // Corrupted or unavailable storage (e.g. private mode) — start fresh.
    }
    setState((s) => ({ ...s, isHydrated: true }));
  }, []);

  function setReportData(idea: string, report: ValidationReport) {
    setState({ idea, report, isHydrated: true });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ idea, report }));
    } catch {
      // Storage unavailable — state still works for the rest of this render.
    }
  }

  function clearReport() {
    setState((s) => ({ ...s, report: null }));
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing to clean up if storage was never available.
    }
  }

  return (
    <ReportContext.Provider value={{ ...state, setReportData, clearReport }}>{children}</ReportContext.Provider>
  );
}

export function useReport() {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReport must be used within a ReportProvider");
  return ctx;
}
