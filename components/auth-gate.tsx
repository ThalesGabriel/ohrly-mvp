"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, isAuthenticated, isLocalMode } = useAuth();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (loading || isLocalMode) return;

    if (!isAuthenticated && !isLogin) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && isLogin) {
      router.replace("/");
    }
  }, [loading, isAuthenticated, isLogin, isLocalMode, router]);

  if (isLocalMode) return <>{children}</>;

  if (loading || (!isAuthenticated && !isLogin) || (isAuthenticated && isLogin)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
          <LoaderCircle className="animate-spin text-gray-800" size={24} />
          <span>Preparando seu workspace...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
