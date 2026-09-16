"use client";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AuthProvider } from "@/components/auth-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
