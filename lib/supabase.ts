import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    client = null;
    return client;
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}

export function isPermanentUser(user: User | null | undefined) {
  return Boolean(user && !user.is_anonymous);
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const user = data.session?.user ?? null;
  return isPermanentUser(user) ? user : null;
}
