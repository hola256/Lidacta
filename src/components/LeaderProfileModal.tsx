import React, { useState, useEffect } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  X,
  User,
  Mail,
  Briefcase,
  Building2,
  Layers,
  Users,
  Calendar,
  Phone,
  ShieldCheck,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const LeaderProfileModal: React.FC = () => {
  const {
    currentUser,
    isLeaderProfileModalOpen,
    closeLeaderProfileModal,
    updateUserProfile,
    showToast,
  } = useLidacta();

  const [name, setName] = useState(currentUser.name || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [position, setPosition] = useState(currentUser.position || '');
  const [companyName, setCompanyName] = useState(currentUser.companyName || '');
  const [area, setArea] = useState(currentUser.area || '');
  const [directReports, setDirectReports] = useState<string>(
    currentUser.directReports !== undefined && currentUser.directReports !== null
      ? String(currentUser.directReports)
      : '0'
  );
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || '');
  const [whatsapp, setWhatsapp] = useState(currentUser.whatsapp || '');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever modal opens or currentUser updates
  useEffect(() => {
    if (isLeaderProfileModalOpen && currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPosition(currentUser.position || '');
      setCompanyName(currentUser.companyName || '');
      setArea(currentUser.area || '');
      setDirectReports(
        currentUser.directReports !== undefined && currentUser.directReports !== null
          ? String(currentUser.directReports)
          : '0'
      );
      setBirthDate(currentUser.birthDate || '');
      setWhatsapp(currentUser.whatsapp || '');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isLeaderProfileModalOpen, currentUser]);

  if (!isLeaderProfileModalOpen) return null;

  const cleanPhone = whatsapp.replace(/[^0-9]/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido.');
      return;
    }

    if (!position.trim()) {
      setErrorMsg('El puesto o cargo es obligatorio.');
      return;
    }

    if (!companyName.trim()) {
      setErrorMsg('El nombre de la empresa es obligatorio.');
      return;
    }

    if (currentUser.role === 'leader' && !area.trim()) {
      setErrorMsg('El área o departamento es obligatorio.');
      return;
    }

    if (
      currentUser.role === 'leader' &&
      (directReports === '' || isNaN(Number(directReports)) || Number(directReports) < 0)
    ) {
      setErrorMsg('Por favor ingresa un número válido de personas a cargo (0 o más).');
      return;
    }

    if (!whatsapp.trim() || cleanPhone.length < 8) {
      setErrorMsg('Por favor ingresa un número de WhatsApp / teléfono válido con clave de país (ej. +52 55 1234 5678).');
      return;
    }

    setIsSaving(true);

    try {
      const parsedReports = Number(directReports) || 0;
      const updates = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        position: position.trim(),
        companyName: companyName.trim(),
        area: area.trim(),
        directReports: parsedReports,
        birthDate: birthDate.trim(),
        whatsapp: whatsapp.trim(),
        isProfileCompleted: true,
        isProfileComplete: true,
      };

      const result = await updateUserProfile(currentUser.id, updates);

      // Centralized sync to server
      try {
        await fetch('/api/user/complete-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            email: email.trim().toLowerCase(),
            name: name.trim(),
            role: currentUser.role,
            position: position.trim(),
            companyName: companyName.trim(),
            area: area.trim(),
            birthDate: birthDate.trim(),
            directReports: parsedReports,
            whatsapp: whatsapp.trim(),
          }),
        });
      } catch (err) {
        console.warn('Could not sync leader profile update to server:', err);
      }

      setIsSaving(false);

      if (result.success) {
        setSuccessMsg('¡Perfil actualizado con éxito! Tus cambios han sido guardados.');
        showToast('¡Perfil actualizado con éxito! Tus datos se han guardado correctamente.', 'success');
        setTimeout(() => {
          closeLeaderProfileModal();
        }, 900);
      } else {
        setErrorMsg(result.message || 'Error al actualizar el perfil.');
      }
    } catch (err: any) {
      setIsSaving(false);
      setErrorMsg(err?.message || 'Error inesperado al guardar los cambios.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg mx-auto my-auto bg-white rounded-2xl shadow-2xl border border-[#493447]/15 overflow-hidden flex flex-col max-h-[92vh] max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-[#2D1B4E] text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#F7B538] shrink-0">
              <User className="w-5 h-5 text-[#F7B538]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-white flex items-center gap-1.5">
                <span>Actualizar Perfil</span>
                <Sparkles className="w-3.5 h-3.5 text-[#F7B538]" />
              </h2>
              <p className="text-[11px] text-[#FFD3BF] font-medium">
                Modifica tus datos de contacto y contexto de liderazgo
              </p>
            </div>
          </div>
          <button
            onClick={closeLeaderProfileModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 break-words whitespace-normal">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-semibold break-words whitespace-normal">{successMsg}</div>
            </div>
          )}

          {/* Nombre y Correo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Nombre Completo *</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Roberto Gómez"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Correo Electrónico *</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@empresa.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>
          </div>

          {/* Puesto y Empresa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Puesto / Cargo *</span>
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ej. Líder de Operaciones"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Empresa *</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej. Nexus Logistics"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>
          </div>

          {/* Área y Personas a cargo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Área o Departamento *</span>
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej. Operaciones / Logística"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Personas a tu cargo *</span>
              </label>
              <input
                type="number"
                min="0"
                value={directReports}
                onChange={(e) => setDirectReports(e.target.value)}
                placeholder="Ej. 6"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>
          </div>

          {/* Fecha de nacimiento y WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Fecha de Nacimiento</span>
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>WhatsApp / Teléfono *</span>
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ej. +52 55 1234 5678"
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#493447]/20 focus:border-[#BF3A1B] focus:ring-2 focus:ring-[#BF3A1B]/20 outline-none transition-all text-[#2D1B4E] box-border"
                required
              />
            </div>
          </div>

          {/* Guarantee / Privacy note */}
          <div className="p-3 rounded-xl bg-[#FFF7EF] border border-[#FFD3BF] flex items-start gap-2.5 text-[#2D1B4E]">
            <ShieldCheck className="w-4 h-4 text-[#BF3A1B] shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed break-words whitespace-normal">
              <span className="font-bold">Privacidad y Confidencialidad:</span> Tus datos personales se mantienen protegidos. Recursos Humanos no tiene acceso al contenido de tus conversaciones de acompañamiento en Lidacta.
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#493447]/10 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
            <button
              type="button"
              onClick={closeLeaderProfileModal}
              disabled={isSaving}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#493447]/20 hover:bg-[#FFF7EF] text-[#4A3F55] font-semibold transition-all cursor-pointer text-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#BF3A1B] hover:bg-[#A33015] text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
