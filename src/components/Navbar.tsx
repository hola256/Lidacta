import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  Bell,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentUser,
    allUsers,
    switchUser,
    setShowNewUserModal,
    notifications,
    unreadNotificationsCount,
    markNotificationsAsRead,
    openEmailDrawer,
  } = useLidacta();

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  const roleLabels: Record<string, string> = {
    leader: 'Líder',
    hr: 'Recursos Humanos',
    admin: 'Administradora (Creadora)',
  };

  const roleBadges: Record<string, { bg: string; text: string }> = {
    leader: { bg: 'bg-[#FFD3BF] text-[#BF3A1B]', text: 'Líder' },
    hr: { bg: 'bg-[#C9BDF2] text-[#2D1B4E]', text: 'Recursos Humanos' },
    admin: { bg: 'bg-[#F7B538] text-[#2D1B4E]', text: 'Administrador' },
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFF7EF]/95 backdrop-blur-md border-b border-[#493447]/10 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Wordmark & Descriptor */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#2D1B4E] flex items-center justify-center text-[#F7B538] shadow-sm">
            <span className="font-heading font-bold text-lg leading-none">L</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-xl tracking-tight text-[#2D1B4E]">
                Lidacta
              </span>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[#BF3A1B] bg-[#FFD3BF]/60 px-1.5 py-0.5 rounded">
                Líder + Acción
              </span>
            </div>
            <span className="text-xs text-[#4A3F55]/80 hidden sm:inline">
              Desarrollo de Liderazgo en acción
            </span>
          </div>
        </div>

        {/* Zone 2: Confidentiality & Context Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/70 border border-[#493447]/10 rounded-full text-xs text-[#4A3F55]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#BF3A1B]" />
          <span>Espacio 100% Confidencial</span>
          <span className="text-[#493447]/30">·</span>
          <span className="font-medium text-[#2D1B4E] truncate max-w-[200px]">
            {currentUser.companyName}
          </span>
        </div>

        {/* Zone 3: Actions & User Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Email Simulator Button */}
          <button
            onClick={() => openEmailDrawer()}
            title="Ver bandeja de correos transaccionales simulados"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#2D1B4E] bg-white border border-[#493447]/15 rounded-lg hover:bg-[#FFD3BF]/20 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
            <span className="hidden sm:inline">Bandeja de Correos</span>
          </button>

          {/* Notifications Center */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationsDropdown(!showNotificationsDropdown);
                if (!showNotificationsDropdown) markNotificationsAsRead();
              }}
              title="Notificaciones en la aplicación"
              className="relative p-2 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-white rounded-lg border border-transparent hover:border-[#493447]/10 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E8512F]" />
              )}
            </button>

            {showNotificationsDropdown && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#493447]/15 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-[#493447]/10 flex items-center justify-between">
                  <span className="font-heading font-bold text-sm text-[#2D1B4E]">Notificaciones</span>
                  <span className="text-xs text-[#4A3F55]/70">Sistema y Correo</span>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-[#493447]/5">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#4A3F55]/70">
                      No hay notificaciones recientes.
                    </div>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.emailSimulated) openEmailDrawer(n);
                          setShowNotificationsDropdown(false);
                        }}
                        className={`p-3 text-xs hover:bg-[#FFF7EF] cursor-pointer transition-colors ${
                          !n.read ? 'bg-[#FFD3BF]/15' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-[#2D1B4E]">{n.title}</span>
                          <span className="text-[10px] text-[#4A3F55]/60">
                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[#4A3F55] leading-relaxed">{n.message}</p>
                        {n.emailSimulated && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-[#BF3A1B] font-medium">
                            <Mail className="w-3 h-3" />
                            <span>Ver correo enviado</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-white border border-[#493447]/15 rounded-lg hover:border-[#BF3A1B]/40 transition-colors cursor-pointer text-left"
            >
              <div className="w-7 h-7 rounded-full bg-[#493447] text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  currentUser.name.charAt(0)
                )}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-xs font-bold text-[#2D1B4E] leading-tight truncate max-w-[130px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-[#BF3A1B] font-semibold leading-tight">
                  {roleLabels[currentUser.role]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#4A3F55]/70 shrink-0" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-[#493447]/15 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-[#493447]/10">
                  <p className="text-xs font-medium text-[#4A3F55]/70">Cambiar de perfil para probar:</p>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {allUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        switchUser(u.id);
                        setShowUserDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#FFF7EF] transition-colors cursor-pointer ${
                        u.id === currentUser.id ? 'bg-[#FFD3BF]/20 font-semibold' : ''
                      }`}
                    >
                      <div className="flex flex-col truncate pr-2">
                        <span className="text-[#2D1B4E] truncate font-medium">{u.name}</span>
                        <span className="text-[10px] text-[#4A3F55]/70 truncate">
                          {u.position} · {u.companyName}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                          roleBadges[u.role].bg
                        }`}
                      >
                        {roleBadges[u.role].text}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[#493447]/10 pt-1 px-2 mt-1">
                  <button
                    onClick={() => {
                      setShowNewUserModal(true);
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#BF3A1B] hover:bg-[#FFD3BF]/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Registrar nuevo perfil</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
