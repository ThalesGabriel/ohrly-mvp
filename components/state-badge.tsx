import { displayStateLabels, type DisplayState } from "@/lib/display";

export function StateBadge({ state }: { state: DisplayState }) {
  const styles: Record<DisplayState, string> = {
    attention: "bg-orange-50 text-orange-700",
    watch: "bg-gray-100 text-gray-600",
    execution_pending: "bg-violet-50 text-violet-700",
    exception: "bg-red-50 text-red-700",
    waiting_response: "bg-blue-50 text-blue-700",
    recovering: "bg-emerald-50 text-emerald-700",
    review_due: "bg-blue-50 text-blue-700",
    closed: "bg-gray-900 text-white",
  };
  return <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${styles[state]}`}>{displayStateLabels[state]}</span>;
}
