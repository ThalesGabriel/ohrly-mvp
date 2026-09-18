"use client";

import { Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { trajectoryPreview, type EpisodeSignature } from "@/lib/episode-signature";
import {
  getAccountPrivateData,
  getEpisodeAlias,
  getEpisodeNote,
} from "@/lib/local-private";
import {
  reviewPrecedentSuggestion,
  trackEvent,
} from "@/lib/repository";
import {
  changeTypeLabels,
  interventionTypeLabels,
  outcomeLabels,
  precedentEvidenceLabels,
  precedentFeedbackLabels,
  type Episode,
  type Intervention,
  type PrecedentFeedback,
  type PrecedentSuggestion,
  type Review,
} from "@/lib/types";

export function PrecedentTabPanel({
  currentEpisode,
  precedentEpisode,
  currentSignature,
  precedentSignature,
  precedentIntervention,
  precedentReview,
  suggestion,
  onReviewed,
}: {
  currentEpisode: Episode;
  precedentEpisode: Episode;
  currentSignature: EpisodeSignature;
  precedentSignature: EpisodeSignature;
  precedentIntervention: Intervention | null;
  precedentReview: Review;
  suggestion: PrecedentSuggestion;
  onReviewed: (updated: PrecedentSuggestion) => void;
}) {
  const [openedTracked, setOpenedTracked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (openedTracked) return;
    setOpenedTracked(true);
    trackEvent("precedent_opened", currentEpisode.id, null, {
      precedent_episode_id: precedentEpisode.id,
      origin: suggestion.origin,
      evidence_codes: suggestion.evidence_codes,
      matcher_version: suggestion.matcher_version,
      rank_score: suggestion.rank_score,
      current_trajectory_depth: currentSignature.structuralDepth,
    }).catch((trackingError) => {
      console.warn("Could not track precedent opening", trackingError);
    });
  }, [
    currentEpisode.id,
    currentSignature.structuralDepth,
    openedTracked,
    precedentEpisode.id,
    suggestion.evidence_codes,
    suggestion.matcher_version,
    suggestion.origin,
    suggestion.rank_score,
  ]);

  const currentAccount = currentEpisode.account_id ? getAccountPrivateData(currentEpisode.account_id) : null;
  const precedentAccount = precedentEpisode.account_id ? getAccountPrivateData(precedentEpisode.account_id) : null;
  const currentNote = getEpisodeNote(currentEpisode.id);
  const precedentNote = getEpisodeNote(precedentEpisode.id);

  async function submitFeedback(feedback: PrecedentFeedback) {
    try {
      setSaving(true);
      setError("");
      const updated = await reviewPrecedentSuggestion(suggestion, feedback);
      onReviewed(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar sua leitura.");
    } finally {
      setSaving(false);
    }
  }

  const accepted = suggestion.feedback && suggestion.feedback !== "not_relevant";

  return (
    <section >

      <div className="rounded-[18px] border border-sky-100 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-sky-700">
              <Search size={13} /> Precedente
            </div>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {accepted ? "Experiência considerada neste ciclo" : "Essa trajetória parece familiar"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-gray-500">
              {accepted
                ? "Este caso anterior foi considerado relevante para a leitura atual. Ele permanece aqui como contexto, sem substituir o julgamento sobre esta conta."
                : "O Ohrly encontrou uma trajetória anterior em outra conta que começou de forma semelhante e já avançou além do ponto atual. Isso não significa que os casos sejam iguais."}
            </p>
          </div>

          {accepted ? (
            <div className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-800">
              {precedentFeedbackLabels[suggestion.feedback!]}
            </div>
          ) : null}
        </div>

      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <CaseSummary
          eyebrow="Caso atual"
          accountName={currentAccount?.name || "Conta atual"}
          episodeName={getEpisodeAlias(currentEpisode.id)}
          changeLabel={changeTypeLabels[currentEpisode.change_type]}
          note={currentNote}
          signature={currentSignature}
        />
        <CaseSummary
          eyebrow="Precedente"
          accountName={precedentAccount?.name || "Outra conta"}
          episodeName={getEpisodeAlias(precedentEpisode.id)}
          changeLabel={changeTypeLabels[precedentEpisode.change_type]}
          note={precedentNote}
          signature={precedentSignature}
          footer={
            <>
              {precedentIntervention ? <span>{interventionTypeLabels[precedentIntervention.intervention_type]}</span> : null}
              <span>{outcomeLabels[precedentReview.outcome]}</span>
            </>
          }
        />
      </div>

      <div className="mt-4 rounded-[18px] border border-sky-100 bg-white p-5 shadow-soft">
        <div className="text-sm font-bold uppercase tracking-wider text-gray-400">Por que o Ohrly trouxe isso</div>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-500">
          A semelhança é calculada primeiro sobre a sequência de eventos estruturados do ciclo. Texto livre só reforça a leitura quando existe; ele não é necessário para formar o precedente.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestion.evidence_codes.map((code) => (
            <span key={code} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-sm font-semibold text-gray-600">
              {precedentEvidenceLabels[code]}
            </span>
          ))}
        </div>
      </div>

      {!suggestion.feedback ? (
        <div className="mt-4 rounded-[18px] border border-sky-100 bg-white p-5 shadow-soft">
          <div className="text-sm font-semibold text-gray-900">Esse precedente foi útil para pensar este caso?</div>
          <p className="mt-1 text-sm leading-5 text-gray-500">A resposta ajuda o Ohrly a aprender quais trajetórias realmente merecem interromper sua atenção no futuro.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.entries(precedentFeedbackLabels) as [PrecedentFeedback, string][]).map(([value, label]) => (
              <Button key={value} variant="secondary" className="!px-3 !py-2 !text-sm" onClick={() => submitFeedback(value)} disabled={saving}>
                {label}
              </Button>
            ))}
          </div>
          {error ? <p className="mt-2 text-sm font-medium text-red-600">{error}</p> : null}
        </div>
      ) : null}

    </section>
  );
}

function CaseSummary({
  eyebrow,
  accountName,
  episodeName,
  changeLabel,
  note,
  signature,
  footer,
}: {
  eyebrow: string;
  accountName: string;
  episodeName: string;
  changeLabel: string;
  note: string;
  signature: EpisodeSignature;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-bold uppercase tracking-wider text-gray-400">{eyebrow}</div>
      <div className="mt-2 text-sm font-semibold text-gray-500">{accountName}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900">{episodeName}</div>
      <div className="mt-2 text-sm font-medium text-gray-700">{changeLabel}</div>
      <TrajectorySummary signature={signature} />
      {note ? <p className="mt-3 line-clamp-2 text-sm leading-5 text-gray-500">{note}</p> : null}
      {footer ? <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-gray-500">{footer}</div> : null}
    </div>
  );
}

function TrajectorySummary({ signature }: { signature: EpisodeSignature }) {
  const steps = trajectoryPreview(signature);
  if (!steps.length) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="text-sm font-bold uppercase tracking-wider text-gray-400">Trajetória registrada</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium leading-5 text-gray-700">
        {steps.map((step, index) => (
          <span key={`${step.token}-${step.at}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <span className="text-gray-300">→</span> : null}
            <span>{step.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
