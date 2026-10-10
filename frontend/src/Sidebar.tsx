import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  FileText,
  Banknote,
  Truck,
  Wrench,
  ClipboardList,
  Inbox,
  ShieldCheck,
  Package,
  Users,
  BarChart3,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  MoreVertical,
  Sun,
  Moon,
  LogOut,
  Sparkles,
  CircleDollarSign,
  Layers,
  Store
} from 'lucide-react';

type Any = Record<string, any>;

interface SidebarProps {
  page: string;
  go: (k: string) => void;
  role: string;
  isSaasOwner: boolean;
  companyInfo: Any;
  visiblePages: string[];
  theme: string;
  setTheme: React.Dispatch<React.SetStateAction<string>>;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  orderCounts?: Any | null;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string | null;
}

interface NavGroupConfig {
  id: string;
  label: string | null;
  items: NavItemConfig[];
}

export function Sidebar({
  page,
  go,
  role,
  isSaasOwner,
  companyInfo,
  visiblePages,
  theme,
  setTheme,
  onLogout,
  collapsed,
  onToggleCollapsed,
  mobileMenuOpen,
  onCloseMobileMenu,
  orderCounts
}: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Group state for collapsibles
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({
    resumen: true,
    ventas: true,
    taller: true,
    operacion: true,
    gestion: true,
    saas_admin: true
  });

  const tenantName = companyInfo?.name || localStorage.tenantName || 'FIXME TIENDAS';
  const tenantInitials = tenantName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join('') || 'FT';

  const navGroups: NavGroupConfig[] = React.useMemo(() => {
    if (isSaasOwner) {
      return [
        {
          id: 'saas_admin',
          label: 'Administración SaaS',
          items: [
            { id: 'platform-overview', label: 'Panel SaaS', icon: LayoutDashboard },
            { id: 'platform-companies', label: 'Empresas', icon: Building2 },
            { id: 'platform-trials', label: 'Empresas de Prueba', icon: Sparkles },
            { id: 'platform-rates', label: 'Tarifas por Empresa', icon: CircleDollarSign },
            { id: 'platform-plans', label: 'Planes & Módulos', icon: Layers },
            { id: 'platform-payments', label: 'Cobranzas y Recibos', icon: Receipt }
          ]
        }
      ];
    }

    const urgentCount = orderCounts ? ((orderCounts.slaOverdue || 0) + (orderCounts.slaCritical || 0)) : null;

    return [
      {
        id: 'resumen',
        label: null,
        items: [
          { id: 'home', label: 'Resumen', icon: LayoutDashboard }
        ]
      },
      {
        id: 'ventas',
        label: 'Ventas',
        items: [
          { id: 'pos', label: 'Punto de venta', icon: ShoppingCart },
          { id: 'sales', label: 'Ventas', icon: Receipt },
          { id: 'quotes', label: 'Cotizaciones', icon: FileText },
          { id: 'cash', label: 'Caja', icon: Banknote },
          { id: 'deliveries', label: 'Entregas', icon: Truck }
        ]
      },
      {
        id: 'taller',
        label: 'Taller Técnico',
        items: [
          { id: 'my-work', label: 'Mi trabajo', icon: Wrench, badge: urgentCount && urgentCount > 0 ? urgentCount : null },
          { id: 'work-orders', label: 'Órdenes de servicio', icon: ClipboardList },
          { id: 'marketplace', label: 'Bolsa de reparaciones', icon: Inbox },
          { id: 'warranties', label: 'Garantías', icon: ShieldCheck }
        ]
      },
      {
        id: 'operacion',
        label: 'Operación & Stock',
        items: [
          { id: 'products', label: 'Inventario', icon: Package },
          { id: 'customers', label: 'Clientes', icon: Users }
        ]
      },
      {
        id: 'gestion',
        label: 'Gestión & Control',
        items: [
          { id: 'reports', label: 'Reportes', icon: BarChart3 },
          { id: 'administration', label: 'Empresa', icon: Building2 }
        ]
      }
    ];
  }, [isSaasOwner, orderCounts]);

  // Keep group containing active page open
  React.useEffect(() => {
    for (const group of navGroups) {
      if (group.items.some(item => item.id === page)) {
        setOpenGroups(prev => ({ ...prev, [group.id]: true }));
        break;
      }
    }
  }, [page, navGroups]);

  // Keyboard shortcut '[' to toggle collapsed state
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '[' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        onToggleCollapsed();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleCollapsed]);

  // Close menus on outside click
  React.useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.sidebar-user-footer')) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={onCloseMobileMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={`modern-sidebar ${collapsed ? 'collapsed' : 'expanded'} ${mobileMenuOpen ? 'drawer-open' : ''}`}
        aria-label="Barra lateral principal"
      >
        {/* 1. Header / Marca (48px) */}
        <div className="sidebar-brand-header">
          <div className="brand-logo-wrap">
            <div className="brand-icon-box">F</div>
            {!collapsed && (
              <span className="brand-title">
                {isSaasOwner ? (
                  <>Fixme<span className="brand-highlight">SaaS</span></>
                ) : (
                  <>Fixme<span className="brand-highlight">Tiendas</span></>
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menú ([)' : 'Colapsar menú ([)'}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        {/* 2. Selector de Empresa / Sucursal (UNA fila, 48px) */}
        <div
          className="workspace-switcher-row"
          title={isSaasOwner ? 'Control Global SaaS' : `${tenantName} · Sucursal Principal`}
          onClick={() => { if (!isSaasOwner) go('administration'); }}
        >
          <div className="workspace-badge">{tenantInitials}</div>
          {!collapsed && (
            <div className="workspace-details">
              <span className="workspace-name">{tenantName}</span>
              <span className="workspace-branch">
                {isSaasOwner ? '● Super Admin SaaS' : '● Sucursal Principal'}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="workspace-chevron" aria-hidden="true">
              <Store size={14} />
            </div>
          )}
        </div>

        {/* 3. Navegación Principal (sin scroll visible) */}
        <nav className="sidebar-nav" aria-label="Navegación del sistema">
          {navGroups.map(group => {
            const visibleItems = group.items.filter(item => visiblePages.includes(item.id));
            if (visibleItems.length === 0) return null;

            const isOpen = openGroups[group.id] ?? true;

            return (
              <div key={group.id} className="sidebar-group">
                {group.label && !collapsed && (
                  <button
                    type="button"
                    className="sidebar-group-header"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      size={13}
                      className={`group-chevron ${isOpen ? 'open' : ''}`}
                    />
                  </button>
                )}

                {/* Group items (shown if standalone, or if group is open or sidebar collapsed) */}
                {(!group.label || isOpen || collapsed) && (
                  <div className="sidebar-items-list">
                    {visibleItems.map(item => {
                      const Icon = item.icon;
                      const isActive = page === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            go(item.id);
                            onCloseMobileMenu();
                          }}
                          title={collapsed ? item.label : undefined}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <span className="nav-btn-icon">
                            <Icon size={17} strokeWidth={isActive ? 2.2 : 1.75} />
                          </span>

                          {!collapsed && (
                            <span className="nav-btn-label">{item.label}</span>
                          )}

                          {!collapsed && item.badge != null && (
                            <span className="nav-btn-badge" title="Atención requerida">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 4. Pie de Usuario (UNA fila, 56px) */}
        <div className="sidebar-user-footer">
          <div className="user-avatar-circle" title={`Usuario: ${role}`}>
            {isSaasOwner ? '👑' : (role ? role.slice(0, 1).toUpperCase() : 'U')}
          </div>

          {!collapsed && (
            <div className="user-text-info">
              <span className="user-display-name">
                {isSaasOwner ? 'SaaS Owner' : (role.replace('_', ' ') || 'Usuario')}
              </span>
              <span className="user-status-text">
                <span className="status-dot-online" /> En línea
              </span>
            </div>
          )}

          <div className="user-menu-dropdown-wrapper">
            <button
              type="button"
              className="user-menu-trigger-btn"
              onClick={(e) => {
                e.stopPropagation();
                setUserMenuOpen(!userMenuOpen);
              }}
              aria-label="Opciones de usuario"
              title="Perfil, tema y sesión"
            >
              <MoreVertical size={16} />
            </button>

            {/* Contextual User Menu Popover */}
            {userMenuOpen && (
              <div className="user-context-menu" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className="user-context-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    go('administration');
                  }}
                >
                  <Building2 size={15} />
                  <span>Configuración Empresa</span>
                </button>

                <button
                  type="button"
                  className="user-context-item"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setTheme(t => t === 'dark' ? 'light' : 'dark');
                  }}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                </button>

                <div className="user-context-divider" />

                <button
                  type="button"
                  className="user-context-item danger"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                >
                  <LogOut size={15} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
