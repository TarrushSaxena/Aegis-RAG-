"use client";

import useSWR from "swr";
import { AnalyticsOverview, fetchAnalyticsOverview } from "../api";

export function useAnalytics() {
  return useSWR<AnalyticsOverview>("analytics", fetchAnalyticsOverview, { refreshInterval: 5000 });
}
