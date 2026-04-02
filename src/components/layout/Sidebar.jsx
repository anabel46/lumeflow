import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Package, Factory, Warehouse,
  ShieldCheck, ChevronLeft, ChevronRight, BookOpen,
  Scissors, Flame, Paintbrush, CircleDot, Palette, Sparkles,
  Zap, Layers, Box, Package as PackageIcon, Cog, Menu, X, Headphones, FileText, UserCog, ArrowLeftRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTORS } from "@/lib/constants";

const iconMap = {
  Stamp: Factory, Cog, Scissors, Flame, Paintbrush, CircleDot,
  Palette, Sparkles, Zap, Layers, Box, ShieldCheck, Package: PackageIcon,
};

const mainNav = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { path: "/producao", label: "Produção", icon: Factory },
  { path: "/catalogo", label: "Catálogo", icon: BookOpen },
  { path: "/estoque", label: "Estoque", icon: Warehouse },
  { path: "/qualidade", label: "Qualidade", icon: ShieldCheck },
  { path: "/sac", label: "SAC", icon: Headphones },
  { path: "/relatorios", label: "Relatórios", icon: FileText },
  { path: "/administracao", label: "Administração", icon: UserCog },
  { path: "/integracao-sankhya", label: "Integração Sankhya", icon: ArrowLeftRight },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sectorsOpen, setSectorsOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm text-sidebar-foreground truncate">LumiFlow</h1>
            <p className="text-[10px] text-sidebar-foreground/50">Gestão de Produção</p>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" style={{ overflowAnchor: "none" }}>
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mb-2 px-3", collapsed && "text-center")}>
          {collapsed ? "•" : "Menu"}
        </p>
        {mainNav.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
              isActive(item.path)
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        ))}

        {/* Setores */}
        <div className="pt-3">
          <button
            onClick={() => setSectorsOpen(!sectorsOpen)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full text-left text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? "•" : "Setores"}
            {!collapsed && (
              <ChevronRight className={cn("w-3 h-3 ml-auto transition-transform", sectorsOpen && "rotate-90")} />
            )}
          </button>
          {(sectorsOpen || collapsed) && (
            <div className="space-y-0.5">
              {SECTORS.map((sector) => {
                const Icon = iconMap[sector.icon] || Factory;
                const path = `/setor/${sector.id}`;
                return (
                  <Link
                    key={sector.id}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-200",
                      isActive(path)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground/80"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{sector.label}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border hidden lg:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors text-xs"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Recolher</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card rounded-lg shadow-lg border"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full bg-sidebar" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 text-sidebar-foreground/50">
              <X className="w-5 h-5" />
            </button>
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-60"
      )}>
        <NavContent />
      </aside>
    </>
  );
}