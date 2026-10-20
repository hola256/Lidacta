import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  Building2,
  Calendar,
  Phone,
  Users,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  LogOut,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export const CompleteProfileView: React.FC = () => {
  const { currentUser, completeUserProfile, logout, companies } = useLidacta();

  // Role identification
  const isLeader = currentUser.role === 'leader';
  const isHR = currentUser.role === 'hr';

  // Form states initialized with existing values if available
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [area, setArea] = useState(currentUser.area || '');
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || '');
  const [directReports, setDirectReports] = useState<string>(
    currentUser.directReports !== undefined && currentUser.directReports !== null
      ? String(currentUser.directReports)
      : ''
  );
  const [whatsapp, setWhatsapp] = useState(currentUser.whatsapp || '');

  // Validation states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Field validation helpers
  const isCompanyValid = companyName.trim().length > 0;
  const isBirthDateValid = birthDate.trim().length > 0;
  const isWhatsappValid = whatsapp.trim().length >= 8;
  const isAreaValid = !isLeader || area.trim().length > 0;
  const isDirectReportsValid =
    !isLeader ||
    (directReports.trim().length > 0 &&
      !isNaN(Number(directReports)) &&
      Number(directReports) >= 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Mark all touched
    setTouched({
      companyName: true,
      birthDate: true,
      whatsapp: true,
      area: true,
      directReports: true,
    });

    // Validate mandatory fields
    if (!isCompanyValid) {
      setErrorMessage('Por favor ingresa el nombre de tu empresa.');
      return;
    }

    if (isLeader && !isAreaValid) {
      setErrorMessage('Por favor ingresa el área a la que perteneces.');
      return;
    }

    if (!isBirthDateValid) {
      setErrorMessage('Por favor selecciona tu fecha de nacimiento.');
      return;
    }

    if (isLeader && !isDirectReportsValid) {
      setErrorMessage('Por favor ingresa el número de personas a tu cargo.');
      return;
    }

    if (!isWhatsappValid) {
      setErrorMessage('Por favor ingresa un número de WhatsApp válido.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const result = completeUserProfile({
        companyName: companyName.trim(),
        birthDate: birthDate.trim(),
        whatsapp: whatsapp.trim(),
        ...(isLeader
          ? {
              area: area.trim(),
              directReports: Number(directReports),
            }
          : {}),
      });

      if (result.success) {
        setIsSuccess(true);
        // The context updates and isProfileComplete becomes true,
        // triggering transition to the respective panel (HR or Leader).
      } else {
        setIsSubmitting(false);
        setErrorMessage(result.message || 'Error al guardar el perfil.');
      }
    }, 400);
  };

  return (
    <div className="min-h-screen w-full bg-[#2D1B4E] flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans text-white relative overflow-x-hidden selection:bg-[#FFD3BF] selection:text-[#2D1B4E]">
      {/* Decorative ambient gradients */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#493447]/50 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#BF3A1B]/20 blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-screen-xl mx-auto flex items-center justify-between py-2 shrink-0 z-10">
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

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden xs:flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/15 rounded-full text-xs text-[#FFF7EF]">
            <ShieldCheck className="w-4 h-4 text-[#F7B538] shrink-0" />
            <span>Paso 2 de 2: Onboarding</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs text-[#FFF7EF] font-medium transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5 text-[#FFD3BF]" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-xl mx-auto my-6 sm:my-8 flex-1 flex flex-col justify-center z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Onboarding White Card */}
        <div className="bg-[#FFFDF9] text-[#2D1B4E] rounded-3xl p-6 sm:p-9 shadow-2xl border-t-4 border-[#BF3A1B] relative overflow-hidden">
          {/* Subtle top indicator */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#493447]/10">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FFD3BF]/40 text-[#BF3A1B]">
                <Sparkles className="w-3.5 h-3.5" />
                {isLeader ? 'Rol: Líder' : isHR ? 'Rol: Recursos Humanos (RH)' : 'Perfil'}
              </span>
            </div>
            <span className="text-xs text-[#4A3F55]/70 font-medium">
              Hola, <strong className="text-[#2D1B4E]">{currentUser.name}</strong>
            </span>
          </div>

          <div className="text-left space-y-1.5 mb-6">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#2D1B4E] tracking-tight">
              Completa tu perfil para acceder
            </h1>
            <p className="text-xs sm:text-sm text-[#4A3F55]/80 leading-relaxed">
              {isLeader
                ? 'Para habilitar tu panel de acompañamiento reflexivo, ingresa los datos obligatorios de tu entorno operativo.'
                : 'Para habilitar el panel de gestión y analítica de talento, confirma los datos obligatorios de tu empresa y contacto.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-[#BF3A1B]/10 border border-[#BF3A1B]/30 rounded-xl flex items-center gap-3 text-xs text-[#BF3A1B] font-semibold animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Nombre de la empresa (Obligatorio para RH y Líder) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
                Nombre de la empresa <span className="text-[#BF3A1B]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4A3F55]/50">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => {
                    setCompanyName(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, companyName: true }))}
                  placeholder="ej. Industrias Nexus Automotriz"
                  className={`w-full pl-10 pr-4 py-2.5 bg-white border ${
                    touched.companyName && !isCompanyValid
                      ? 'border-[#BF3A1B] ring-1 ring-[#BF3A1B]'
                      : 'border-[#493447]/20 focus:border-[#BF3A1B]'
                  } rounded-xl text-sm text-[#2D1B4E] placeholder-[#4A3F55]/40 outline-none transition-all shadow-xs`}
                />
              </div>
              {/* Optional Quick Company Suggestions */}
              {companies.length > 0 && !companyName && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-[#4A3F55]/70">Sugerencias:</span>
                  {companies.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCompanyName(c.name)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-[#FFF7EF] hover:bg-[#FFD3BF]/30 text-[#2D1B4E] font-medium border border-[#493447]/10 transition-colors cursor-pointer"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Área (Solo obligatoria para Líder) */}
            {isLeader && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
                  Área <span className="text-[#BF3A1B]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4A3F55]/50">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, area: true }))}
                    placeholder="ej. Operaciones de Manufactura, Ventas, Logística..."
                    className={`w-full pl-10 pr-4 py-2.5 bg-white border ${
                      touched.area && !isAreaValid
                        ? 'border-[#BF3A1B] ring-1 ring-[#BF3A1B]'
                        : 'border-[#493447]/20 focus:border-[#BF3A1B]'
                    } rounded-xl text-sm text-[#2D1B4E] placeholder-[#4A3F55]/40 outline-none transition-all shadow-xs`}
                  />
                </div>
              </div>
            )}

            {/* Two-column layout for birthDate and directReports (or full width for RH) */}
            <div
              className={`grid grid-cols-1 ${
                isLeader ? 'sm:grid-cols-2' : ''
              } gap-3.5`}
            >
              {/* Fecha de nacimiento (Obligatorio para RH y Líder) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
                  Fecha de nacimiento <span className="text-[#BF3A1B]">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4A3F55]/50">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => {
                      setBirthDate(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onBlur={() => setTouched((p) => ({ ...p, birthDate: true }))}
                    className={`w-full pl-10 pr-3 py-2.5 bg-white border ${
                      touched.birthDate && !isBirthDateValid
                        ? 'border-[#BF3A1B] ring-1 ring-[#BF3A1B]'
                        : 'border-[#493447]/20 focus:border-[#BF3A1B]'
                    } rounded-xl text-sm text-[#2D1B4E] outline-none transition-all shadow-xs`}
                  />
                </div>
              </div>

              {/* Número de personas a cargo (Obligatorio solo para Líder) */}
              {isLeader && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
                    Personas a cargo <span className="text-[#BF3A1B]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4A3F55]/50">
                      <Users className="w-4 h-4" />
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={directReports}
                      onChange={(e) => {
                        setDirectReports(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onBlur={() => setTouched((p) => ({ ...p, directReports: true }))}
                      placeholder="ej. 12"
                      className={`w-full pl-10 pr-3 py-2.5 bg-white border ${
                        touched.directReports && !isDirectReportsValid
                          ? 'border-[#BF3A1B] ring-1 ring-[#BF3A1B]'
                          : 'border-[#493447]/20 focus:border-[#BF3A1B]'
                      } rounded-xl text-sm text-[#2D1B4E] placeholder-[#4A3F55]/40 outline-none transition-all shadow-xs`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Número de WhatsApp (Obligatorio para RH y Líder) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#2D1B4E]">
                Número de WhatsApp <span className="text-[#BF3A1B]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4A3F55]/50">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onBlur={() => setTouched((p) => ({ ...p, whatsapp: true }))}
                  placeholder="+52 55 1234 5678"
                  className={`w-full pl-10 pr-4 py-2.5 bg-white border ${
                    touched.whatsapp && !isWhatsappValid
                      ? 'border-[#BF3A1B] ring-1 ring-[#BF3A1B]'
                      : 'border-[#493447]/20 focus:border-[#BF3A1B]'
                  } rounded-xl text-sm text-[#2D1B4E] placeholder-[#4A3F55]/40 outline-none transition-all shadow-xs`}
                />
              </div>
              <p className="text-[11px] text-[#4A3F55]/70">
                Se usará para recordatorios confidenciales de compromisos y planes de acción.
              </p>
            </div>

            {/* Submit Button in Ámbar Impulso (#F7B538) */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className="w-full py-3.5 px-6 rounded-xl bg-[#F7B538] hover:bg-[#F5A623] text-[#2D1B4E] font-heading font-extrabold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-[#F7B538]/25 hover:shadow-xl hover:shadow-[#F7B538]/30 transition-all cursor-pointer active:scale-98 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-[#2D1B4E] border-t-transparent rounded-full animate-spin" />
                    <span>Guardando y verificando perfil...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[#2D1B4E]" />
                    <span>¡Perfil completado! Redirigiendo...</span>
                  </>
                ) : (
                  <>
                    <span>Guardar y acceder al panel de {isLeader ? 'Líder' : 'Recursos Humanos'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer note */}
          <div className="mt-5 pt-3 border-t border-[#493447]/10 flex items-center justify-center gap-2 text-center text-xs text-[#4A3F55]/70">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F7B538] shrink-0" />
            <span>Información protegida y de uso exclusivo para tu experiencia Lidacta.</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-screen-xl mx-auto py-3 text-center text-xs text-[#FFF7EF]/60 shrink-0 z-10">
        Lidacta © {new Date().getFullYear()} · Plataforma de Desarrollo de Liderazgo Operativo
      </footer>
    </div>
  );
};
