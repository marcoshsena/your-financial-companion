import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { ErrorState, SectionCard } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequireAuth } from "@/hooks/use-session";
import { useProfile } from "@/lib/finance-queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/configuracoes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurações da conta — Patrimônio" },
      {
        name: "description",
        content: "Atualize seu nome, veja o e-mail da conta e encerre a sessão com segurança.",
      },
      { property: "og:title", content: "Configurações da conta — Patrimônio" },
      {
        property: "og:description",
        content: "Gerencie seu perfil e a sessão da sua conta no Patrimônio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { userId, email, loading } = useRequireAuth();
  const enabled = Boolean(userId);
  const profile = useProfile(enabled);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  useEffect(() => {
    if (profile.data?.full_name) setName(profile.data.full_name);
  }, [profile.data?.full_name]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, full_name: name.trim() || null }, { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Perfil atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Erro ao salvar perfil."),
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <AppShell title="Configurações" description="Seu perfil e sessão.">
      {profile.error ? <ErrorState error={profile.error} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Perfil">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="full-name">Nome</Label>
              <Input
                id="full-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                disabled={loading}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={email ?? ""} readOnly disabled />
            </div>
            <div>
              <Button onClick={() => save.mutate()} disabled={save.isPending || loading}>
                Salvar alterações
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Sessão">
          <p className="text-muted-foreground text-sm">
            Encerre a sessão neste dispositivo. Seus dados continuam salvos na nuvem.
          </p>
          <Button variant="outline" className="mt-3" onClick={signOut}>
            Sair da conta
          </Button>
        </SectionCard>
      </div>
    </AppShell>
  );
}
