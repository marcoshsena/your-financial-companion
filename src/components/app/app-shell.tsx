import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  Landmark,
  LineChart,
  Link2,
  Menu,
  Settings,
  Tags,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/contas", label: "Contas", icon: Landmark },
  { to: "/investimentos", label: "Investimentos", icon: LineChart },
  { to: "/conexoes", label: "Conexões", icon: Link2 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const nav = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-primary",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="bg-background min-h-screen lg:flex">
      <aside className="bg-card hidden w-64 shrink-0 border-r lg:flex lg:flex-col">
        <div className="border-b px-5 py-5">
          <Link to="/painel" className="font-display text-primary text-lg font-semibold">
            Patrimônio
          </Link>
        </div>
        <div className="flex-1 px-3 py-4">{nav}</div>
        <div className="border-t p-3">
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="bg-card/80 sticky top-0 z-20 border-b px-4 py-3 backdrop-blur lg:px-8 lg:py-5">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setOpen((v) => !v)}
            >
              <Menu className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-primary truncate text-lg font-semibold lg:text-2xl">
                {title}
              </h1>
              {description ? (
                <p className="text-muted-foreground mt-0.5 hidden text-sm lg:block">{description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
          {open ? <div className="mt-3 lg:hidden">{nav}</div> : null}
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
