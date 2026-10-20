"use client";

// Holds the current upload in memory so it survives the client-side
// navigation from the upload screen ("/") to the map screen ("/explore").

import { createContext, useContext, useState, type ReactNode } from "react";
import type { UploadedData } from "./upload-summary";

type UploadState = {
  upload: UploadedData | null;
  setUpload: (upload: UploadedData | null) => void;
};

const UploadContext = createContext<UploadState | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [upload, setUpload] = useState<UploadedData | null>(null);
  return <UploadContext.Provider value={{ upload, setUpload }}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const value = useContext(UploadContext);
  if (!value) throw new Error("useUpload must be used inside <UploadProvider>.");
  return value;
}
