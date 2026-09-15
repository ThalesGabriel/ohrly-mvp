"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, ListTodo, LogOut, Plus, ShieldCheck, UserRound } from "lucide-react";
import { repositoryMode } from "@/lib/repository";
import { useAuth } from "@/components/auth-provider";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, isLocalMode } = useAuth();
  const [mode, setMode] = useState<"supabase" | "local">("local");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => { setMode(repositoryMode()); }, []);

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="bg-gray-900 px-5 py-6 text-white lg:sticky lg:top-0 lg:h-screen">
        <div className="text-[22px] font-extrabold tracking-[-0.04em]">ohrly</div>
        <div className="mt-1 text-xs text-gray-400">Field MVP · Episode Workspace</div>

        <nav className="mt-8 flex gap-2 overflow-x-auto lg:flex-col">
          <NavLink href="/" active={pathname === "/"} icon={<ListTodo size={16} />}>Fila de trabalho</NavLink>
          <NavLink href="/episodes/new" active={pathname === "/episodes/new"} icon={<Plus size={16} />}>Registrar episódio</NavLink>
        </nav>

        <div className="mt-5 rounded-xl border border-gray-700 p-3 text-[11px] leading-5 text-gray-400 lg:absolute lg:bottom-[148px] lg:left-5 lg:right-5 lg:mt-0">
          <strong className="text-gray-200">Princípio do V0</strong><br />A conta é contexto. O episódio é o objeto de trabalho. O ciclo inteiro acontece numa timeline viva.
        </div>

        {!isLocalMode && user ? (
          <div className="mt-3 rounded-xl border border-gray-700 p-3 lg:absolute lg:bottom-[64px] lg:left-5 lg:right-5 lg:mt-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-800 text-gray-300"><UserRound size={15} /></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-gray-200">{user.email ?? "Usuário Ohrly"}</div>
                <div className="mt-0.5 text-[10px] text-emerald-400">Acesso seguro</div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                title="Sair"
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white disabled:opacity-50"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-[11px] text-gray-300 lg:absolute lg:bottom-5 lg:left-5 lg:right-5 lg:mt-0">
          {mode === "supabase" ? <Activity size={14} /> : <ShieldCheck size={14} />}
          <span>{mode === "supabase" ? "Supabase conectado · RLS ativo" : "Modo local · sem backend configurado"}</span>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"}`}>
      {icon}{children}
    </Link>
  );
}
