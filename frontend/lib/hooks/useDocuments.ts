"use client";

import useSWR from "swr";
import { DocumentRecord, fetchDocuments } from "../api";

export function useDocuments() {
  return useSWR<DocumentRecord[]>("documents", fetchDocuments, { refreshInterval: 2500 });
}

