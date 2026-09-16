export function LoadingBlock({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="rounded-[18px] border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-soft">
      {label}
    </div>
  );
}
