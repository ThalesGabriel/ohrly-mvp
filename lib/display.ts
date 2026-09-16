import { addDays, isBefore } from "date-fns";
import type { Episode, Intervention, Review } from "@/lib/types";

export type DisplayState =
  | "attention"
  | "watch"
  | "execution_pending"
  | "exception"
  | "waiting_response"
  | "recovering"
  | "review_due"
  | "closed";

export function reviewDueAt(intervention: Intervention, latestReview: Review | null = null) {
  const base = latestReview?.created_at ?? intervention.executed_at ?? intervention.created_at;
  return addDays(new Date(base), intervention.review_window_days);
}

export function deriveDisplayState(
  episode: Episode,
  intervention: Intervention | null,
  latestReview: Review | null,
): DisplayState {
  if (episode.closed_at) return "closed";
  if (!intervention) return episode.initial_state === "watch" ? "watch" : "attention";
  if (intervention.execution_state === "exception") return "exception";
  if (intervention.execution_state === "planned") return "execution_pending";

  if (isBefore(reviewDueAt(intervention, latestReview), new Date())) return "review_due";

  if (latestReview?.outcome === "partial_recovery") return "recovering";
  if (latestReview?.outcome === "too_early") return "waiting_response";
  if (latestReview?.outcome === "relapse" || latestReview?.outcome === "worsened" || latestReview?.outcome === "no_change") {
    return "attention";
  }
  if (latestReview?.outcome === "recovered") return "recovering";
  return "waiting_response";
}

export const displayStateLabels: Record<DisplayState, string> = {
  attention: "ATENÇÃO",
  watch: "OBSERVANDO",
  execution_pending: "EXECUÇÃO PENDENTE",
  exception: "EXCEÇÃO",
  waiting_response: "AGUARDANDO RESPOSTA",
  recovering: "RECUPERANDO",
  review_due: "REVISAR AGORA",
  closed: "CICLO FECHADO",
};

export function nextStepForState(state: DisplayState) {
  switch (state) {
    case "attention": return "Decidir se intervém ou continua observando.";
    case "watch": return "Acompanhar a trajetória até surgir evidência para agir.";
    case "execution_pending": return "Confirmar se a intervenção realmente aconteceu.";
    case "exception": return "Resolver o desvio de execução ou ajustar a intervenção.";
    case "waiting_response": return "Acompanhar a resposta até a próxima revisão.";
    case "recovering": return "Continuar acompanhando até recuperação, recaída ou novo padrão.";
    case "review_due": return "Revisar a resposta observada agora.";
    case "closed": return "Ciclo encerrado. O histórico fica preservado.";
  }
}
