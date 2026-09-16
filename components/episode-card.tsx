"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getEpisodeAlias } from "@/lib/local-private";
import { changeTypeLabels, type Episode, type Intervention, type Review } from "@/lib/types";
import { deriveDisplayState } from "@/lib/display";
import { StateBadge } from "@/components/state-badge";

export function EpisodeCard({ episode, intervention, latestReview }: { episode: Episode; intervention: Intervention | null; latestReview: Review | null }) {
  const state = deriveDisplayState(episode, intervention, latestReview);
  const age = formatDistanceToNowStrict(new Date(episode.created_at), { locale: ptBR, addSuffix: true });

  return (
    <Link
      href={`/episodes/${episode.id}`}
      className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-gray-900">{getEpisodeAlias(episode.id)}</div>
          <div className="mt-1 text-xs text-gray-500">{changeTypeLabels[episode.change_type]} · registrado {age}</div>
        </div>
        <StateBadge state={state} />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gray-900"
          style={{ width: state === "closed" ? "100%" : state === "review_due" ? "92%" : intervention ? "62%" : "34%" }}
        />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-[11px] text-gray-500">
        <span>{intervention ? "Intervenção registrada" : "Intervenção ainda não registrada"}</span>
        <span>{latestReview ? `Última leitura: ${latestReview.outcome.replaceAll("_", " ")}` : "Sem outcome ainda"}</span>
      </div>
    </Link>
  );
}
