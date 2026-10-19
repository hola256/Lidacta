import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { UserRole } from '../types/lidacta';
import {
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Building2,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, registerOrSetPassword, allUsers, companies } = useLidacta();

  // Mode: 'login' (Iniciar Sesión) or 'register' (Crear Contraseña / Registro inicial)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'comp_nexus');
  const [showPassword, setShowPassword] = useState(false);

  // Status & feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, ingresa tu correo electrónico.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Por favor, ingresa tu contraseña de acceso.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = login(email, password);
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.message || 'Credenciales inválidas.');
      }
    }, 300);
  };

  // Handle Register / Create Password submission
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Ingresa un correo electrónico corporativo.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('La contraseña debe contener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden. Por favor, verifícalas.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = registerOrSetPassword(email, password, name, role);
      setIsLoading(false);
      if (!res.success) {
        setErrorMessage(res.message || 'No se pudo crear la cuenta.');
      }
    }, 350);
  };

  // Quick Demo Access handlers
  const handleQuickLoginAdmin = () => {
    setErrorMessage(null);
    setIsLoading(true);
    setTimeout(() => {
      login('hola@taniapadierna.com');
      setIsLoading(false);
    }, 250);
  };

  const handleQuickLoginLeader = () => {
    setErrorMessage(null);
    setIsLoading(true);
    setTimeout(() => {
      login('roberto.gomez@nexus-auto.com');
      setIsLoading(false);
    }, 250);
  };

  const handleQuickLoginHR = () => {
    setErrorMessage(null);
    setIsLoading(true);
    setTimeout(() => {
      login('sofia.valenzuela@nexus-auto.com');
      setIsLoading(false);
    }, 250);
  };

  return (
    <div className="min-h-screen w-full bg-[#2D1B4E] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans text-white relative overflow-x-hidden selection:bg-[#FFD3BF] selection:text-[#2D1B4E]">
      {/* Decorative ambient subtle glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#493447]/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#BF3A1B]/15 blur-3xl pointer-events-none" />

      {/* Top Brand Bar */}
      <header className="w-full max-w-screen-xl mx-auto flex items-center justify-between py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#F7B538] shadow-md shrink-0">
            <span className="font-heading font-extrabold text-xl leading-none">L</span>
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-extrabold text-2xl tracking-tight text-white">
              Lidacta
            </span>
            <span className="text-xs text-[#FFF7EF]/80">
              Desarrollo de Liderazgo en acción
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/15 rounded-full text-xs text-[#FFF7EF] shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#F7B538] shrink-0" />
          <span className="hidden sm:inline">Acceso Seguro y Confidencial</span>
          <span className="sm:hidden font-medium">Seguro</span>
        </div>
      </header>

      {/* Main Centered Login / Registration Container */}
      <main className="w-full max-w-md mx-auto my-6 sm:my-10 flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-[#24153F]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F7B538]/15 border border-[#F7B538]/30 text-[#F7B538] mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              Portal de Acceso
            </h1>
            <p className="text-xs sm:text-sm text-[#FFF7EF]/80 leading-relaxed max-w-sm mx-auto">
              Ingresa tus credenciales para acceder a tus herramientas operativas, sesiones confidenciales y paneles de gestión.
            </p>
          </div>

          {/* Navigation Tabs: Iniciar Sesión / Crear Contraseña */}
          <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-[#F7B538] text-[#2D1B4E] shadow-sm font-extrabold'
                  : 'text-[#FFF7EF]/70 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Iniciar Sesión</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-[#F7B538] text-[#2D1B4E] shadow-sm font-extrabold'
                  : 'text-[#FFF7EF]/70 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Crear Contraseña</span>
            </button>
          </div>

          {/* Error / Alert notification banner in Coral Profundo (#BF3A1B) */}
          {errorMessage && (
            <div className="p-3 bg-[#BF3A1B]/25 border border-[#BF3A1B] text-[#FFF7EF] rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#FFD3BF] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: INICIAR SESIÓN */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@empresa.com o hola@taniapadierna.com"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="text-[11px] text-[#F7B538] hover:underline cursor-pointer"
                  >
                    ¿Primera vez? Crear clave
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-white/50 hover:text-white cursor-pointer p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Button: Ámbar Impulso (#F7B538) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] py-3 px-6 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-lg shadow-[#F7B538]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Verificando credenciales...</span>
                ) : (
                  <>
                    <span>Ingresar a Lidacta</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: CREAR CONTRASEÑA / REGISTRO */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Roberto Gómez o Tania Padierna"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tania@lidacta.com o tu.correo@empresa.com"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Rol de Acceso
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'admin', label: 'Admin' },
                    { id: 'leader', label: 'Líder' },
                    { id: 'hr', label: 'RRHH' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id as UserRole)}
                      className={`py-2 px-1 text-center rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        role === r.id
                          ? 'bg-[#F7B538] text-[#2D1B4E] border-[#F7B538]'
                          : 'bg-white/5 text-white/70 border-white/15 hover:border-white/30'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                    Contraseña
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3.5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                    Confirmar Clave
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full px-3.5 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              {/* Action Button: Ámbar Impulso (#F7B538) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] py-3 px-6 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-lg shadow-[#F7B538]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Registrando usuario...</span>
                ) : (
                  <>
                    <span>Crear Contraseña y Acceder</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Access (1 Click Direct Access to Admin Role) */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFF7EF]/70 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                Acceso Rápido de Prueba (1 Clic)
              </span>
            </div>

            {/* Direct Admin Access Button highlighted with Ámbar Impulso and Coral acents */}
            <button
              type="button"
              onClick={handleQuickLoginAdmin}
              className="w-full p-3 bg-[#F7B538]/15 hover:bg-[#F7B538]/25 border border-[#F7B538]/40 rounded-2xl flex items-center justify-between transition-all cursor-pointer group text-left active:scale-98 shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  👑
                </div>
                <div>
                  <span className="font-heading font-bold text-xs sm:text-sm text-white group-hover:text-[#F7B538] transition-colors block">
                    Ingresar como Administradora
                  </span>
                  <span className="text-[10px] text-[#FFF7EF]/70 block">
                    Tania Padierna · Acceso total al panel administrativo
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#F7B538] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* Other quick test accounts */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <button
                type="button"
                onClick={handleQuickLoginLeader}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left cursor-pointer transition-colors"
              >
                <span className="font-semibold text-[#FFD3BF] block">Líder Operativo</span>
                <span className="text-[10px] text-[#FFF7EF]/60 truncate block">Roberto Gómez</span>
              </button>
              <button
                type="button"
                onClick={handleQuickLoginHR}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left cursor-pointer transition-colors"
              >
                <span className="font-semibold text-[#C9BDF2] block">Recursos Humanos</span>
                <span className="text-[10px] text-[#FFF7EF]/60 truncate block">Sofía Valenzuela</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-screen-xl mx-auto py-3 text-center text-xs text-[#FFF7EF]/60 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#F7B538]" />
          <span>Protocolo Estricto de Confidencialidad y Encriptación</span>
        </div>
        <div>
          <span>Lidacta © 2026 · Plataforma de Liderazgo y Acción</span>
        </div>
      </footer>
    </div>
  );
};
