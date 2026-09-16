"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { LoadingBlock } from "@/components/loading";

export default function LegacyInterventionRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => { router.replace(`/episodes/${params.id}`); }, [params.id, router]);
  return <AppShell><LoadingBlock /></AppShell>;
}
