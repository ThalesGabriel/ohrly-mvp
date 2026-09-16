export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
      <strong>Não foi possível concluir esta ação.</strong>
      <div>{message}</div>
    </div>
  );
}
