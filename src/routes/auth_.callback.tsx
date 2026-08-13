import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finalizando login — Patrimônio" },
      {
        name: "description",
        content: "Concluindo o acesso à sua conta para abrir o painel financeiro.",
      },
      { property: "og:title", content: "Finalizando login — Patrimônio" },
      {
        property: "og:description",
        content: "Estamos concluindo seu acesso ao painel financeiro.",
      },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const go = (to: "/painel" | "/auth") => {
      if (done) return;
      done = true;
      void navigate({ to, replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go("/painel");
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) go("/painel");
    });

    const timeout = window.setTimeout(() => go("/auth"), 8000);

    return () => {
      window.clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-muted-foreground text-sm">Concluindo seu acesso…</p>
    </main>
  );
}
