import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Landmark, LineChart, PieChart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Patrimônio — controle financeiro e carteira em tempo real" },
      {
        name: "description",
        content:
          "Plataforma de gestão financeira pessoal: lançamentos categorizados, Open Finance automático e carteira de investimentos com cotações em tempo real.",
      },
      { property: "og:title", content: "Patrimônio — controle financeiro em tempo real" },
      {
        property: "og:description",
        content:
          "Receitas, despesas, contas conectadas por Open Finance e carteira de investimentos com preço médio, proventos e rendimento.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: PieChart,
    title: "Lançamentos que você controla",
    text: "Registre entradas e saídas, categorize, edite descrições e mantenha o histórico limpo.",
  },
  {
    icon: RefreshCw,
    title: "Open Finance automático",
    text: "Conecte suas contas bancárias via Pluggy e receba transações e saldos sem digitar nada.",
  },
  {
    icon: LineChart,
    title: "Carteira ao vivo",
    text: "Cotações de ações, FIIs, ETFs, BDRs e cripto, com preço médio e rendimento atualizados.",
  },
  {
    icon: Landmark,
    title: "Proventos e resultado",
    text: "Dividendos recebidos, lucro realizado e evolução mensal do seu fluxo de caixa.",
  },
];

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-lg font-semibold text-primary">Patrimônio</span>
        <Button asChild variant="outline">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-20">
        <p className="text-sm font-semibold tracking-widest text-accent uppercase">
          Gestão financeira em tempo real
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold text-primary sm:text-6xl">
          Todo o seu dinheiro e seus investimentos em um só painel.
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-lg">
          Lance e categorize receitas e despesas, conecte suas contas por Open Finance para
          alimentação automática e acompanhe sua carteira com cotações, preço médio, posições e
          proventos.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Criar minha conta <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link to="/auth">Já tenho conta</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.title} className="surface p-6">
              <feature.icon className="text-accent size-6" />
              <h2 className="mt-4 text-base font-semibold text-primary">{feature.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
