import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { UserRole } from '../types/lidacta';
import { emailService } from '../services/emailService';
import {
  Lock,
  Mail,
  KeyRound,
  User,
  Briefcase,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { registerOrSetPassword, login, allUsers, companies, showToast } = useLidacta();

  // Mode: Iniciar Sesión vs Registrar Nuevo Usuario
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('leader');
  const [position, setPosition] = useState('');
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'comp_nexus');
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-fill profile helpers when typing recognizable emails in login mode
  const handleEmailChange = (val: string) => {
    setEmail(val);
    const lower = val.trim().toLowerCase();
    const existing = allUsers.find((u) => u.email.toLowerCase() === lower);
    if (existing && authMode === 'login') {
      if (!name) setName(existing.name);
      setRole(existing.role);
      if (!position) setPosition(existing.position);
      setCompanyId(existing.companyId);
    }
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Por favor, ingresa tu correo electrónico corporativo.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Por favor, ingresa tu contraseña de acceso.');
      return;
    }

    setIsLoading(true);

    try {
      const res = login(cleanEmail, password.trim());
      if (!res.success) {
        // If user does not exist, suggest registration
        const exists = allUsers.some((u) => u.email.toLowerCase() === cleanEmail);
        if (!exists) {
          setErrorMessage(
            'No encontramos una cuenta con este correo. Puedes crear tu cuenta en la pestaña "Registrar Nuevo Usuario".'
          );
        } else {
          setErrorMessage(res.message || 'No se pudo iniciar sesión. Verifica tus credenciales.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error inesperado al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  // Registration handler with full field validation
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setEmailStatus(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanPosition = position.trim();

    // Required Field Validations
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Por favor, ingresa tu nombre completo.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Por favor, ingresa un correo electrónico corporativo válido.');
      return;
    }

    // Check duplicate
    const exists = allUsers.some((u) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      setErrorMessage('Ya existe una cuenta registrada con este correo. Inicia sesión directamente.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage('La contraseña de acceso debe tener al menos 6 caracteres.');
      return;
    }

    if (!cleanPosition) {
      setErrorMessage('Por favor, ingresa tu puesto o cargo dentro de la empresa.');
      return;
    }

    if (companyId === 'other' && !customCompanyName.trim()) {
      setErrorMessage('Por favor, ingresa el nombre de tu empresa u organización.');
      return;
    }

    setIsLoading(true);

    try {
      const targetCompanyName =
        companyId === 'other'
          ? (customCompanyName.trim() || 'Mi Empresa')
          : (companies.find((c) => c.id === companyId)?.name || 'Industrias Nexus Automotriz');

      console.log(`[PortalDeAcceso] 📝 Registrando usuario en la Base de Datos Central: ${cleanName} (${cleanEmail})...`);
      const res = await registerOrSetPassword(
        cleanEmail,
        cleanPassword,
        cleanName,
        role,
        cleanPosition,
        companyId,
        companyId === 'other' ? customCompanyName.trim() : undefined
      );

      if (!res.success) {
        setErrorMessage(res.message || 'Error al procesar el registro en la base de datos central.');
        setIsLoading(false);
        return;
      }

      // Explicitly await sendWelcomeEmail immediately after user creation
      console.log(`[PortalDeAcceso] 🚀 Ejecutando llamada esperada (await) a emailService.sendWelcomeEmail para ${cleanEmail}...`);
      const emailResult = await emailService.sendWelcomeEmail({
        email: cleanEmail,
        name: cleanName,
        role,
        companyName: targetCompanyName,
      });

      if (!emailResult.success) {
        console.error('Resend delivery failed:', emailResult.error);
        setEmailStatus({
          type: 'error',
          message: `⚠️ Tu usuario fue registrado exitosamente, pero la API de Resend no pudo entregar el correo de bienvenida a ${cleanEmail}: "${emailResult.error || 'Aviso de entrega'}". Revisa la configuración de Resend.`,
        });
        showToast(`Aviso: Error en Resend: ${emailResult.error || 'Fallo de entrega'}`, 'warning');
      } else {
        console.log(`[PortalDeAcceso] ✅ Correo de bienvenida entregado exitosamente vía Resend. ID: ${emailResult.emailId}`);
        setEmailStatus({
          type: 'success',
          message: `✅ ¡Usuario registrado! Correo de bienvenida entregado con éxito a ${cleanEmail} (ID Resend: ${emailResult.emailId || 'OK'}).`,
        });
        showToast(`¡Bienvenida entregada a ${cleanEmail}!`, 'success');
      }
    } catch (err: any) {
      console.error('Error durante el registro:', err);
      setErrorMessage(err?.message || 'Error al conectar con la base de datos central.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-click test handlers
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
      <header className="w-full max-w-screen-xl mx-auto min-h-20 md:min-h-24 flex items-center justify-between py-2.5 sm:py-3 shrink-0">
        <div className="flex items-center shrink-0">
          <img
            src="/logo.svg"
            alt="Lidacta - Desarrollo de Liderazgo en Acción"
            className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto object-contain select-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/15 rounded-full text-xs text-[#FFF7EF] shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#F7B538] shrink-0" />
          <span className="hidden sm:inline">Acceso Seguro y Confidencial</span>
          <span className="sm:hidden font-medium">Seguro</span>
        </div>
      </header>

      {/* Main Centered Login / Registration Container */}
      <main className="w-full max-w-lg mx-auto my-6 sm:my-8 flex-1 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-[#24153F]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Card Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F7B538]/15 border border-[#F7B538]/30 text-[#F7B538] mb-1">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
              Portal de Acceso
            </h1>
            <p className="text-xs sm:text-sm text-[#FFF7EF]/80 leading-relaxed max-w-sm mx-auto">
              {authMode === 'login'
                ? 'Ingresa tus credenciales para acceder a Lidacta'
                : 'Crea tu nueva cuenta para comenzar tu acompañamiento'}
            </p>
          </div>

          {/* Mode Selector Tabs: Iniciar Sesión vs Registrarse */}
          <div className="grid grid-cols-2 p-1 bg-white/5 border border-white/15 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMessage(null);
                setRole('leader');
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-[#F7B538] text-[#2D1B4E] shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              + Registrar Nuevo Usuario
            </button>
          </div>

          {/* Error / Alert notification banner - Alerta roja visible de error en registro o Resend */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/90 border-2 border-rose-500 text-rose-100 rounded-xl text-xs sm:text-sm flex items-start gap-3 shadow-lg animate-in fade-in" role="alert">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <span className="font-bold text-rose-200 block text-xs uppercase tracking-wider">Error en la Solicitud / Envío</span>
                <span className="leading-relaxed block text-rose-100 font-medium">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Email Notification Status Banner: Advertencia visible si Resend falla o Éxito */}
          {emailStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in ${
                emailStatus.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/80 text-emerald-200'
                  : 'bg-rose-950/70 border border-rose-500/90 text-rose-200'
              }`}
            >
              {emailStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="flex-1 space-y-0.5">
                <span className="font-bold block">
                  {emailStatus.type === 'success' ? 'Correo de Bienvenida Enviado' : 'Alerta de Entrega de Correo (Resend)'}
                </span>
                <span className="leading-relaxed block">{emailStatus.message}</span>
              </div>
            </div>
          )}

          {/* FORM: INICIAR SESIÓN */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in">
              {/* Correo Electrónico */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Correo Electrónico *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="tu.correo@empresa.com"
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Contraseña *
                </label>
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
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botón Acceder */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] py-3.5 px-6 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-lg shadow-[#F7B538]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span>Validando credenciales...</span>
                ) : (
                  <>
                    <span>Acceder a Lidacta</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage(null);
                    setRole('leader');
                  }}
                  className="text-xs text-[#FFD3BF] hover:underline cursor-pointer"
                >
                  ¿No tienes cuenta aún? Registrar nuevo usuario
                </button>
              </div>
            </form>
          )}

          {/* FORM: REGISTRAR NUEVO USUARIO (Con validación y persistencia central) */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 animate-in fade-in">
              {/* 1. Nombre Completo */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Nombre Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Roberto Gómez o Carlos Mendoza"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              {/* 2. Correo Electrónico Corporativo */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Correo Electrónico Corporativo *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.correo@empresa.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              {/* 3. Contraseña */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Contraseña de Acceso (mínimo 6 caracteres) *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3.5 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-white/50 hover:text-white cursor-pointer p-0.5"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 4. Empresa */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                    Empresa Asociada *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (companyId === 'other') {
                        setCompanyId(companies[0]?.id || 'comp_nexus');
                      } else {
                        setCompanyId('other');
                      }
                    }}
                    className="text-[11px] text-[#F7B538] hover:text-[#FFD3BF] hover:underline cursor-pointer font-medium"
                  >
                    {companyId === 'other' ? '← Seleccionar de la lista' : '+ Otra Empresa'}
                  </button>
                </div>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-3 text-[#FFF7EF]/50 pointer-events-none" />
                  <select
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      if (e.target.value !== 'other') {
                        setCustomCompanyName('');
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#24153F] border border-white/20 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-[#BF3A1B]"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#24153F] text-white">
                        {c.name}
                      </option>
                    ))}
                    <option value="other" className="bg-[#24153F] text-[#F7B538] font-bold">
                      + Otra Empresa (Escribir nombre personalizado...)
                    </option>
                  </select>
                </div>

                {/* Input for custom company when 'other' is selected */}
                {companyId === 'other' && (
                  <div className="mt-2 space-y-1 animate-in fade-in duration-200">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#FFD3BF]">
                      Nombre de tu Empresa u Organización *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute left-3.5 top-3 text-[#FFD3BF] pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={customCompanyName}
                        onChange={(e) => setCustomCompanyName(e.target.value)}
                        placeholder="Escribe el nombre de tu empresa..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-[#F7B538]/60 rounded-xl text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#F7B538] focus:ring-1 focus:ring-[#F7B538] transition-all"
                        autoFocus
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Rol en la Plataforma (Default: Líder) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Rol en la Plataforma *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'leader', label: 'Líder' },
                    { id: 'hr', label: 'Recursos Humanos' },
                    { id: 'admin', label: 'Administradora' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id as UserRole)}
                      className={`py-2 px-1 text-center rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        role === r.id
                          ? 'bg-[#F7B538] text-[#2D1B4E] border-[#F7B538] shadow-xs'
                          : 'bg-white/5 text-white/70 border-white/15 hover:border-white/30'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Puesto / Cargo */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#FFF7EF]/90">
                  Puesto / Cargo *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3.5 top-3 text-[#FFF7EF]/50 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder={
                      role === 'leader'
                        ? 'Líder de Línea / Supervisor de Operaciones'
                        : role === 'hr'
                        ? 'Directora de Gestión Humana'
                        : 'Administradora de Plataforma'
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-xs sm:text-sm text-white placeholder-white/35 focus:outline-none focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/50 transition-all"
                  />
                </div>
              </div>

              {/* Botón Confirmar Registro */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] py-3.5 px-6 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-lg shadow-[#F7B538]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-3"
              >
                {isLoading ? (
                  <span>Registrando usuario en la Base de Datos Central...</span>
                ) : (
                  <>
                    <span>Confirmar Registro y Acceder</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage(null);
                  }}
                  className="text-xs text-[#FFD3BF] hover:underline cursor-pointer"
                >
                  ¿Ya tienes cuenta registrada? Iniciar sesión
                </button>
              </div>
            </form>
          )}

          {/* Quick Demo Access (1-Click Instant Access) */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FFF7EF]/70 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
                Acceso Rápido de Prueba (1 Clic)
              </span>
            </div>

            {/* Direct Admin Access Button */}
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

            {/* Quick buttons for Líder and RRHH */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <button
                type="button"
                onClick={handleQuickLoginLeader}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left cursor-pointer transition-colors"
              >
                <span className="font-semibold text-[#FFD3BF] block">Líder Activo</span>
                <span className="text-[10px] text-[#FFF7EF]/60 truncate block">Roberto Gómez</span>
              </button>
              <button
                type="button"
                onClick={handleQuickLoginHR}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left cursor-pointer transition-colors"
              >
                <span className="font-semibold text-[#C9BDF2] block">RH Activa</span>
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
