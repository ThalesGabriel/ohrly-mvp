"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LoadingBlock } from "@/components/loading";
import { ErrorBox } from "@/components/error-box";
import { getIntervention } from "@/lib/repository";

export default function LegacyReviewRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    getIntervention(params.id)
      .then((intervention) => {
        if (!intervention) throw new Error("Intervenção não encontrada.");
        router.replace(`/episodes/${intervention.episode_id}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro inesperado."));
  }, [params.id, router]);

  return <AppShell>{error ? <ErrorBox message={error} /> : <LoadingBlock />}</AppShell>;
}
