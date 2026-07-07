"use client";

import useSWR from "swr";
import { fetchSessions, SessionSummary } from "../api";

export function useSessions() {
  return useSWR<SessionSummary[]>("sessions", fetchSessions, { refreshInterval: 5000 });
}
