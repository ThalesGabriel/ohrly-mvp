export function LoopStepper({ active }: { active: "observe" | "act" | "learn" }) {
  const steps = [
    { id: "observe", label: "OBSERVE", text: "O que mudou?" },
    { id: "act", label: "ACT", text: "O que você fez?" },
    { id: "learn", label: "LEARN", text: "O que aconteceu?" },
  ] as const;
  const activeIndex = steps.findIndex((x) => x.id === active);

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "future";
        const classes =
          state === "done"
            ? "bg-emerald-50 text-emerald-900"
            : state === "active"
              ? "bg-orange-50 text-orange-900"
              : "bg-gray-100 text-gray-500";
        return (
          <div key={step.id} className={`rounded-xl p-3 text-xs ${classes}`}>
            <strong className="mb-1 block text-gray-900">{step.label}</strong>
            {step.text}
          </div>
        );
      })}
    </div>
  );
}
