"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { sendMagicLink, isLocalMode } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    try {
      setSending(true);
      setError("");
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link de acesso.");
    } finally {
      setSending(false);
    }
  }

  if (isLocalMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4">
        <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-soft">
          <div className="text-2xl font-extrabold tracking-[-0.04em]">ohrly</div>
          <p className="mt-3 text-sm leading-6 text-gray-500">A autenticação aparece quando as variáveis do Supabase estão configuradas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
      <section className="hidden bg-gray-900 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div>
          <div className="text-[24px] font-extrabold tracking-[-0.04em]">ohrly</div>
          <div className="mt-1 text-sm text-gray-400">Closed-loop Customer Success</div>
        </div>

        <div className="max-w-xl pb-10">
          <div className="mb-5 inline-flex rounded-full border border-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-300">EARLY ACCESS</div>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-[-0.045em] xl:text-5xl">
            Acompanhe a história entre o primeiro sinal e o resultado.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-gray-300">
            Veja o que começou a mudar, registre a intervenção do time e preserve o que aconteceu depois — no mesmo ciclo.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-gray-300">
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-sm font-bold">1</span> Observe uma mudança persistente.</div>
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-sm font-bold">2</span> Acompanhe a intervenção real.</div>
            <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800 text-sm font-bold">3</span> Volte para revisar recuperação, piora ou recaída.</div>
          </div>
        </div>

        <div className="text-sm leading-5 text-gray-500">Field MVP · Dados operacionais livres permanecem locais no navegador.</div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-9 lg:hidden">
            <div className="text-[24px] font-extrabold tracking-[-0.04em]">ohrly</div>
            <div className="mt-1 text-sm text-gray-500">Closed-loop Customer Success</div>
          </div>

          <div className="rounded-[24px] border border-gray-200 bg-white p-7 shadow-soft sm:p-8">
            {!sent ? (
              <>
                <div className="mb-7">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 text-white"><ShieldCheck size={20} /></div>
                  <h2 className="text-2xl font-extrabold tracking-[-0.035em] text-gray-900">Entre no seu workspace</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">Use seu e-mail profissional. Enviaremos um link seguro de acesso — sem senha.</p>
                </div>

                <form onSubmit={submit}>
                  <label className="block text-sm font-semibold text-gray-700" htmlFor="email">E-mail</label>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="voce@empresa.com"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                    />
                  </div>

                  {error ? <div className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</div> : null}

                  <button
                    type="submit"
                    disabled={sending}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "Enviando..." : "Enviar link de acesso"}
                    {!sending ? <ArrowRight size={16} /> : null}
                  </button>
                </form>

                <div className="mt-5 border-t border-gray-100 pt-5 text-center text-sm leading-5 text-gray-400">
                  Ao entrar, você acessa somente os episódios associados à sua própria conta.
                </div>
              </>
            ) : (
              <div className="py-3 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 size={24} /></div>
                <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.035em] text-gray-900">Confira seu e-mail</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
                  Enviamos um link de acesso para <strong className="font-semibold text-gray-800">{email}</strong>. Clique nele para entrar no Ohrly.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-6 text-sm font-semibold text-gray-700 underline underline-offset-4"
                >
                  Usar outro e-mail
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 text-center text-sm leading-5 text-gray-400">Ohrly · Early access para operações de Customer Success.</div>
        </div>
      </section>
    </div>
  );
}
