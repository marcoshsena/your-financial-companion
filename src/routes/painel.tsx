import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/painel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel — Patrimônio" },
      {
        name: "description",
        content: "Acompanhe receitas, despesas, contas conectadas e sua carteira de investimentos.",
      },
      { property: "og:title", content: "Painel — Patrimônio" },
      {
        property: "og:description",
        content: "Seu resumo financeiro com Open Finance e carteira em tempo real.",
      },
    ],
  }),
  component: PainelPage,
});

function PainelPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        void navigate({ to: "/auth", replace: true });
        return;
      }
      setEmail(data.session.user.email ?? null);
    });
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold text-primary">Painel</h1>
          <Button variant="outline" onClick={signOut}>
            Sair
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">{email}</p>
        <div className="surface mt-8 p-6">
          <h2 className="text-base font-semibold text-primary">Em construção</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Lançamentos, conexões de Open Finance e carteira de investimentos entram aqui na
            sequência.
          </p>
        </div>
      </div>
    </main>
  );
}
