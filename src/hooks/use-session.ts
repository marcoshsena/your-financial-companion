import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, userId: session?.user.id ?? null };
}

/** Redireciona para /auth quando não há sessão. Usar em todas as páginas financeiras. */
export function useRequireAuth() {
  const navigate = useNavigate();
  const { session, loading, userId } = useSession();

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  return { session, loading, userId, email: session?.user.email ?? null };
}
