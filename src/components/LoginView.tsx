import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { UserProfile, UserRole } from '../types/lidacta';
import { emailService } from '../services/emailService';
import { safeString, extractErrorMessage } from '../utils/safeError';
import { isHumanResourcesRole, isAdminRole, getRoleDisplayName } from '../utils/roleUtils';
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
  ArrowLeft,
  ArrowDown,
  AlertCircle,
  Building2,
  CheckCircle2,
  UserCheck,
  Compass,
  Users,
  Lightbulb,
  MessageSquare,
  Target,
  Award,
  Bot,
} from 'lucide-react';

const TYPICAL_CHALLENGES = [
  {
    title: 'Retroalimentación constructiva',
    icon: MessageSquare,
  },
  {
    title: 'Manejo de conflictos',
    icon: Users,
  },
  {
    title: 'Delegación y seguimiento',
    icon: Target,
  },
  {
    title: 'Comunicación con el equipo',
    icon: Lightbulb,
  },
  {
    title: 'Motivación y alineación',
    icon: Compass,
  },
];

const STAGES_OVERVIEW = [
  {
    num: 1,
    title: 'Detectar qué sucede',
    desc: 'Comprender el desafío que enfrenta el líder.',
  },
  {
    num: 2,
    title: 'Analizar perspectivas y habilidades',
    desc: 'Analizar perspectivas y habilidades de liderazgo involucradas.',
  },
  {
    num: 3,
    title: 'Diseñar alternativas',
    desc: 'Explorar alternativas de solución.',
  },
  {
    num: 4,
    title: 'Practicar antes de actuar',
    desc: 'Practicar antes de actuar, cuando sea pertinente.',
  },
  {
    num: 5,
    title: 'Actuar',
    desc: 'Construir su propio plan de acción.',
  },
  {
    num: 6,
    title: 'Aprender y reflexionar',
    desc: 'Reflexionar sobre su experiencia y aprendizajes.',
  },
  {
    num: 7,
    title: 'Cierre y retroalimentación',
    desc: 'Recibir un reporte final que integra su proceso.',
  },
];

const KEY_DIFFERENTIATORS = [
  {
    title: 'Acompañamiento personalizado',
    desc: 'Cada proceso parte del contexto, las circunstancias y los involucrados en la situación específica que vive el líder.',
    icon: UserCheck,
  },
  {
    title: 'Inteligencia artificial aplicada al desarrollo',
    desc: 'Utiliza modelos de lenguaje guiados por una metodología pedagógica para cuestionar, orientar y facilitar la reflexión, sin sustituir el criterio ni las decisiones del líder.',
    icon: Bot,
  },
  {
    title: 'Aprendizaje orientado a la acción',
    desc: 'No se queda en conceptos teóricos; ayuda al líder a definir compromisos concretos, ensayar conversaciones cuando es necesario y reflexionar sobre los resultados obtenidos.',
    icon: Target,
  },
];

export const LoginView: React.FC = () => {
  const { registerOrSetPassword, login, allUsers, companies, showToast } = useLidacta();

  // Detect if a user previously logged in on this browser (via LocalStorage)
  const [rememberedUser, setRememberedUser] = useState<UserProfile | null>(() => {
    try {
      const raw =
        localStorage.getItem('lidacta_remembered_user') ||
        localStorage.getItem('lidacta_v2_remembered_user') ||
        localStorage.getItem('lidacta_v2_session_user') ||
        sessionStorage.getItem('lidacta_v2_session_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.email || parsed.id)) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });

  const [showOtherAccount, setShowOtherAccount] = useState<boolean>(false);

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
          setErrorMessage(extractErrorMessage(res.message, 'No se pudo iniciar sesión. Verifica tus credenciales.'));
        }
      }
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err, 'Error inesperado al iniciar sesión.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Registration handler with full field validation and mobile resilience
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setEmailStatus(null);

    // Mobile resilience: trim all input values immediately to eliminate accidental whitespace from mobile keyboard autocomplete
    const cleanName = name.replace(/\s+/g, ' ').trim();
    const cleanEmail = email.replace(/[\u200B-\u200D\uFEFF\s]/g, '').trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanPosition = position.replace(/\s+/g, ' ').trim();
    const cleanCustomCompany = customCompanyName.replace(/\s+/g, ' ').trim();

    // Required Field Validations
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage('Por favor, ingresa tu nombre completo (mínimo 2 caracteres).');
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

    if (companyId === 'other' && !cleanCustomCompany) {
      setErrorMessage('Por favor, ingresa el nombre de tu empresa u organización.');
      return;
    }

    setIsLoading(true);

    try {
      console.log(`[PortalDeAcceso] 📝 Registrando usuario en la Base de Datos Central: ${cleanName} (${cleanEmail})...`);
      const res = await registerOrSetPassword(
        cleanEmail,
        cleanPassword,
        cleanName,
        role,
        cleanPosition,
        companyId,
        companyId === 'other' ? cleanCustomCompany : undefined
      );

      if (!res.success) {
        setErrorMessage(extractErrorMessage(res.message, 'Error al procesar el registro en la base de datos central.'));
        setIsLoading(false);
        return;
      }

      // Registro exitoso: Feedback amigable y transición automática fluida
      console.log(`[PortalDeAcceso] ✅ Usuario registrado con éxito: ${cleanEmail}`);
      showToast('¡Cuenta creada exitosamente! Bienvenido a Lidacta.', 'success');
    } catch (err: any) {
      console.error('Error durante el registro:', err);
      setErrorMessage(extractErrorMessage(err, 'Error al conectar con la base de datos central.'));
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click access for recognized device/browser session
  const handleResumeRememberedSession = () => {
    if (!rememberedUser) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = login(rememberedUser.email, rememberedUser.password, true);
      if (!res.success) {
        setEmail(rememberedUser.email);
        setShowOtherAccount(true);
        setErrorMessage(extractErrorMessage(res.message, 'Por favor, ingresa tu contraseña para continuar.'));
      }
    } catch (err: any) {
      setEmail(rememberedUser.email);
      setShowOtherAccount(true);
      setErrorMessage(extractErrorMessage(err, 'Por favor, ingresa tu contraseña para acceder.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = () => {
    setShowOtherAccount(true);
    setErrorMessage(null);
    setEmail('');
    setPassword('');
  };

  const scrollToAccess = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const el = document.getElementById('portal-acceso');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#2D1B4E] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans text-white relative overflow-x-hidden selection:bg-[#FFD3BF] selection:text-[#2D1B4E]">
      {/* Decorative ambient subtle glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#493447]/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#BF3A1B]/15 blur-3xl pointer-events-none" />

      {/* Top Brand Bar */}
      <header className="w-full max-w-screen-xl mx-auto min-h-20 md:min-h-24 flex items-center justify-between gap-3 py-2.5 sm:py-3 shrink-0 relative z-10">
        <div className="flex items-center shrink-0">
          <img
            src="/logo.svg"
            alt="Lidacta - Desarrollo de Liderazgo en Acción"
            className="h-12 sm:h-14 md:h-16 lg:h-20 w-auto object-contain select-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={scrollToAccess}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#F7B538]/15 transition-all cursor-pointer active:scale-98"
          >
            <span>Acceder a Lidacta</span>
            <ArrowDown className="w-3.5 h-3.5 shrink-0" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/15 rounded-full text-xs text-[#FFF7EF] shrink-0">
            <ShieldCheck className="w-4 h-4 text-[#F7B538] shrink-0" />
            <span className="hidden sm:inline">Acceso Seguro y Confidencial</span>
            <span className="sm:hidden font-medium">Seguro</span>
          </div>
        </div>
      </header>

      {/* Public Presentation + Access Portal Container */}
      <main className="w-full max-w-screen-xl mx-auto flex-1 flex flex-col relative z-10">
        {/* Sección 1: Presentación principal (Hero) */}
        <section className="pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-20 border-b border-white/10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF7EF] border border-[#BF3A1B]/30 text-[#2D1B4E] text-xs sm:text-sm font-semibold tracking-wide shadow-sm">
              <Sparkles className="w-4 h-4 text-[#BF3A1B] shrink-0" />
              <span>Lidacta · Desarrollo de Liderazgo en Acción</span>
            </div>

            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
              Capacitar a los lideres es importante. <span className="text-[#F7B538]">Acompañarlos</span> cuando necesitan ponerlo en <span className="text-[#F7B538]">práctica</span> es el verdadero <span className="text-[#F7B538]">reto</span>.
            </h1>

            <div className="max-w-3xl mx-auto space-y-4 text-sm sm:text-base lg:text-lg text-[#FFF7EF]/85 leading-relaxed">
              <p>
                Lidacta es una plataforma de mentoría para líderes, impulsada por inteligencia artificial, que acompaña a quienes coordinan personas a comprender y resolver situaciones cotidianas de liderazgo.
              </p>
              <p>
                A través de conversaciones guiadas y un proceso estructurado de siete etapas, transforma los desafíos reales del trabajo en oportunidades de aprendizaje y aplicación práctica.
              </p>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={scrollToAccess}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-extrabold text-sm sm:text-base rounded-xl shadow-lg shadow-[#F7B538]/20 transition-all cursor-pointer active:scale-98"
              >
                <span>Acceder a Lidacta</span>
                <ArrowDown className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        </section>

        {/* Sección 2: El problema que atendemos */}
        <section className="py-12 sm:py-16 border-b border-white/10">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <span className="text-xs font-heading font-bold uppercase tracking-widest text-[#F7B538]">
                El desafío cotidiano
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                Liderar personas también implica enfrentar desafíos cotidianos.
              </h2>
              <p className="text-sm sm:text-base text-[#FFF7EF]/80 leading-relaxed max-w-3xl mx-auto">
                Quienes coordinan equipos toman decisiones constantes sobre retroalimentación, manejo de conflictos, comunicación, delegación y motivación. Sin embargo, el aprendizaje tradicional suele llegar lejos del momento en que ocurre la situación. Lidacta acerca el acompañamiento justo cuando el líder necesita analizar un reto real y decidir cómo actuar.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              {TYPICAL_CHALLENGES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFD3BF] border border-[#BF3A1B]/25 text-xs sm:text-sm font-semibold text-[#2D1B4E] shadow-sm"
                  >
                    <Icon className="w-4 h-4 text-[#BF3A1B] shrink-0" />
                    <span>{item.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Sección 3: ¿Cómo funciona Lidacta? */}
        <section className="py-12 sm:py-16 border-b border-white/10">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <span className="text-xs font-heading font-bold uppercase tracking-widest text-[#F7B538]">
                ¿Cómo funciona Lidacta?
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                Un proceso de acompañamiento en siete etapas.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STAGES_OVERVIEW.map((stage, idx) => (
                <div
                  key={stage.num}
                  className={`p-5 rounded-2xl border shadow-md flex items-start gap-4 ${
                    idx % 2 === 0
                      ? 'bg-[#FFF7EF] border-[#EADBCB]'
                      : 'bg-[#EADBCB] border-[#BF3A1B]/20'
                  } ${
                    stage.num === 7 ? 'sm:col-span-2 lg:col-span-3 lg:max-w-md lg:mx-auto lg:w-full' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#FFFFFF] border border-[#BF3A1B]/35 text-[#BF3A1B] font-heading font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {stage.num}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-heading font-bold text-sm sm:text-base text-[#2D1B4E]">
                      {stage.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#2D1B4E]/80 leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sección 4: ¿Qué hace diferente a Lidacta? */}
        <section className="py-12 sm:py-16 border-b border-white/10">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center space-y-3">
              <span className="text-xs font-heading font-bold uppercase tracking-widest text-[#F7B538]">
                ¿Qué hace diferente a Lidacta?
              </span>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                Aprender liderazgo a partir de situaciones reales.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {KEY_DIFFERENTIATORS.map((diff, idx) => {
                const Icon = diff.icon;
                return (
                  <div
                    key={diff.title}
                    className={`p-6 rounded-2xl border shadow-md space-y-3 ${
                      idx % 2 === 0
                        ? 'bg-[#FFF7EF] border-[#EADBCB]'
                        : 'bg-[#EADBCB] border-[#BF3A1B]/20'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FFFFFF] border border-[#BF3A1B]/35 text-[#BF3A1B] flex items-center justify-center shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-heading font-bold text-base sm:text-lg text-[#2D1B4E]">
                      {diff.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#2D1B4E]/80 leading-relaxed">
                      {diff.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Sección 5: Acceso a Lidacta (Portal de Acceso existente intacto) */}
        <section id="portal-acceso" className="w-full max-w-lg mx-auto py-12 sm:py-16 scroll-mt-6 flex flex-col justify-center animate-in fade-in zoom-in-95 duration-300">
          <div className="text-center space-y-1.5 mb-6">
            <span className="text-xs font-heading font-bold uppercase tracking-widest text-[#F7B538]">
              Portal de Acceso
            </span>
            <h2 className="font-heading font-extrabold text-2xl text-white tracking-tight">
              Accede a tu cuenta o regístrate
            </h2>
          </div>

          {rememberedUser && !showOtherAccount ? (
          <div className="bg-[#24153F]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            {/* Remembered User Card Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7B538]/15 border border-[#F7B538]/30 text-[#F7B538] text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sesión Recordada en este Dispositivo</span>
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                ¡Hola de nuevo, {rememberedUser.name ? rememberedUser.name.split(' ')[0] : 'Líder'}!
              </h1>
              <p className="text-xs sm:text-sm text-[#FFF7EF]/80 leading-relaxed max-w-sm mx-auto">
                Detectamos tu sesión previa en este navegador. Puedes acceder inmediatamente con un solo clic.
              </p>
            </div>

            {/* User Preview Profile Box */}
            <div className="p-4 bg-white/5 border border-white/15 rounded-2xl flex items-center gap-3.5">
              {rememberedUser.avatarUrl ? (
                <img
                  src={rememberedUser.avatarUrl}
                  alt={rememberedUser.name}
                  className="w-13 h-13 rounded-2xl object-cover border border-[#F7B538]/40 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-linear-to-tr from-[#BF3A1B] to-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-heading font-black text-lg shadow-xs shrink-0">
                  {rememberedUser.name ? rememberedUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-heading font-bold text-base text-white truncate">
                  {rememberedUser.name}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F7B538]/20 text-[#F7B538] border border-[#F7B538]/30">
                    {getRoleDisplayName(rememberedUser.role)}
                  </span>
                  {rememberedUser.companyName && (
                    <span className="text-[11px] text-[#FFF7EF]/70 truncate">
                      · {rememberedUser.companyName}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#FFF7EF]/60 truncate mt-0.5">
                  {rememberedUser.email}
                </div>
              </div>
            </div>

            {/* Error Alert if 1-click fails */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-950/90 border-2 border-rose-500 text-rose-100 rounded-xl text-xs sm:text-sm flex items-start gap-3 shadow-lg animate-in fade-in" role="alert">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-0.5">
                  <span className="font-bold text-rose-200 block text-xs uppercase tracking-wider">Aviso en la Solicitud</span>
                  <span className="leading-relaxed block text-rose-100 font-medium">{safeString(errorMessage)}</span>
                </div>
              </div>
            )}

            {/* Primary 1-Click Action Button */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleResumeRememberedSession}
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-linear-to-r from-[#F7B538] to-[#FF8C42] hover:from-[#f5a91e] hover:to-[#ff7b29] text-[#2D1B4E] font-heading font-extrabold text-sm sm:text-base rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#2D1B4E] border-t-transparent rounded-full animate-spin" />
                    <span>Accediendo...</span>
                  </span>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5 text-[#2D1B4E]" />
                    <span>Continuar como {rememberedUser.name}</span>
                    <ArrowRight className="w-5 h-5 text-[#2D1B4E]" />
                  </>
                )}
              </button>

              {/* Discrete Switch Account option */}
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="w-full py-2.5 text-xs text-[#FFF7EF]/80 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 hover:underline"
              >
                <span>Ingresar con otra cuenta</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#24153F]/95 backdrop-blur-xl border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            {rememberedUser && (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherAccount(false);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#F7B538] hover:text-[#ffd3bf] transition-colors cursor-pointer font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a la cuenta de {rememberedUser.name ? rememberedUser.name.split(' ')[0] : 'usuario'}</span>
                </button>
              </div>
            )}
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

          {/* Error / Alert notification banner - Alerta visible protegida contra error #31 de React */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-950/90 border-2 border-rose-500 text-rose-100 rounded-xl text-xs sm:text-sm flex items-start gap-3 shadow-lg animate-in fade-in" role="alert">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-0.5">
                <span className="font-bold text-rose-200 block text-xs uppercase tracking-wider">Aviso en la Solicitud</span>
                <span className="leading-relaxed block text-rose-100 font-medium">{safeString(errorMessage)}</span>
              </div>
            </div>
          )}

          {/* Email Notification Status Banner */}
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
                  {emailStatus.type === 'success' ? 'Notificación de Correo' : 'Aviso de Envío'}
                </span>
                <span className="leading-relaxed block">{safeString(emailStatus.message)}</span>
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
                    autoCapitalize="words"
                    autoCorrect="off"
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
                    inputMode="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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
                        autoCapitalize="words"
                        autoCorrect="off"
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
                    autoCapitalize="sentences"
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

              {/* Botón Confirmar Registro con indicador visual de carga */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] py-3.5 px-6 bg-[#F7B538] hover:bg-[#e5a62f] text-[#2D1B4E] font-heading font-extrabold text-sm rounded-xl shadow-lg shadow-[#F7B538]/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 mt-3"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-[#2D1B4E] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Registrando usuario en la Base de Datos Central...</span>
                  </div>
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
          </div>
        )}
        </section>
      </main>

      {/* Footer Info */}
      <footer className="w-full max-w-screen-xl mx-auto py-4 text-center text-xs text-[#FFF7EF]/60 flex flex-col lg:flex-row items-center justify-between gap-3 border-t border-white/10 shrink-0 relative z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#F7B538] shrink-0" />
          <span>Protocolo Estricto de Confidencialidad y Encriptación</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[#FFF7EF]/75">
          <a
            href="mailto:hola@lidacta.com"
            className="inline-flex items-center gap-1.5 hover:text-[#F7B538] transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-[#F7B538]/80 shrink-0" />
            <span>hola@lidacta.com</span>
          </a>
          <span className="text-white/25 hidden sm:inline" aria-hidden="true">·</span>
          <a
            href="https://drive.google.com/file/d/1xVUuMbx1myOMCz4_jOa9_HjR8Ua9fJqv/view"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#F7B538] underline decoration-white/25 underline-offset-4 transition-colors"
          >
            Aviso de Privacidad
          </a>
        </div>

        <div>
          <span>Lidacta © 2026 · Plataforma de Liderazgo y Acción</span>
        </div>
      </footer>
    </div>
  );
};
