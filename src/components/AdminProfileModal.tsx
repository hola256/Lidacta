import React, { useState, useEffect } from 'react';
import { useLidacta } from '../context/LidactaContext';
import {
  X,
  UserCheck,
  Mail,
  Phone,
  Building,
  Briefcase,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

export const AdminProfileModal: React.FC = () => {
  const {
    allUsers,
    currentUser,
    isProfileModalOpen,
    closeProfileModal,
    updateUserProfile,
  } = useLidacta();

  // Find admin user in allUsers or fallback to current user
  const adminUser = allUsers.find((u) => u.role === 'admin') || currentUser;

  const [name, setName] = useState(adminUser.name || 'Tania Padierna');
  const [email, setEmail] = useState(adminUser.email || 'hola@taniapadierna.com');
  const [whatsapp, setWhatsapp] = useState(adminUser.whatsapp || '+52 55 1234 5678');
  const [position, setPosition] = useState(adminUser.position || 'Creadora & Directora de Plataforma');
  const [companyName, setCompanyName] = useState(adminUser.companyName || 'Lidacta · Dirección General');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when modal opens or adminUser changes
  useEffect(() => {
    if (isProfileModalOpen && adminUser) {
      setName(adminUser.name || '');
      setEmail(adminUser.email || '');
      setWhatsapp(adminUser.whatsapp || '+52 55 1234 5678');
      setPosition(adminUser.position || '');
      setCompanyName(adminUser.companyName || '');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isProfileModalOpen, adminUser]);

  if (!isProfileModalOpen) return null;

  const cleanPhone = whatsapp.replace(/[^0-9]/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('El nombre completo es obligatorio.');
      return;
    }

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Por favor ingresa un correo electrónico válido (ej. hola@taniapadierna.com).');
      return;
    }

    if (!whatsapp.trim() || cleanPhone.length < 8) {
      setErrorMsg('Por favor ingresa un número de teléfono / WhatsApp válido con clave de país (ej. +52 55 1234 5678).');
      return;
    }

    setIsSaving(true);

    const result = updateUserProfile(adminUser.id, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim(),
      position: position.trim() || 'Directora de Plataforma',
      companyName: companyName.trim() || 'Lidacta',
    });

    setIsSaving(false);

    if (result.success) {
      setSuccessMsg('¡Perfil actualizado con éxito! Este correo y WhatsApp serán los destinatarios oficiales de las solicitudes de Asesoría 1:1.');
      setTimeout(() => {
        closeProfileModal();
      }, 1600);
    } else {
      setErrorMsg(result.message || 'Error al actualizar el perfil.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#2D1B4E]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#493447]/15 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Ciruela Noche */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#2D1B4E] via-[#3d2459] to-[#2D1B4E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7B538] text-[#2D1B4E] flex items-center justify-center font-bold shadow-xs">
              <UserCheck className="w-5 h-5 text-[#2D1B4E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-base sm:text-lg text-white">
                  Mi Perfil de Administradora
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F7B538] text-[#2D1B4E]">
                  Creadora Lidacta
                </span>
              </div>
              <p className="text-xs text-[#FFD3BF] mt-0.5">
                Configuración directiva y canales de alerta para Asesoría 1:1
              </p>
            </div>
          </div>
          <button
            onClick={closeProfileModal}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Nombre Completo */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#2D1B4E] flex items-center gap-1.5">
              <span>Nombre Completo *</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Tania Padierna"
                required
                className="w-full px-3.5 py-2.5 bg-[#FFF7EF] border border-[#493447]/20 rounded-xl text-xs sm:text-sm text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all font-medium"
              />
            </div>
            <p className="text-[11px] text-[#4A3F55]/70">
              Nombre oficial que verán los líderes en las confirmaciones y reportes de mentoría.
            </p>
          </div>

          {/* Correo Electrónico Principal */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#2D1B4E] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                <span>Correo Electrónico Principal *</span>
              </span>
              <span className="text-[10px] text-[#BF3A1B] font-bold">Receptor de Alertas</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo: hola@taniapadierna.com"
                required
                className="w-full px-3.5 py-2.5 bg-[#FFF7EF] border border-[#493447]/20 rounded-xl text-xs sm:text-sm text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all font-medium"
              />
            </div>
            <p className="text-[11px] text-[#4A3F55]/70">
              A esta dirección llegarán automáticamente las alertas transaccionales cuando un líder solicite Asesoría 1:1.
            </p>
          </div>

          {/* Teléfono / WhatsApp */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#2D1B4E] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#246B2A]" />
                <span>Teléfono / WhatsApp (con clave de país) *</span>
              </span>
              <span className="text-[10px] text-[#246B2A] font-bold">WhatsApp Directo</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="ejemplo: +52 55 1234 5678"
                required
                className="w-full px-3.5 py-2.5 bg-[#FFF7EF] border border-[#493447]/20 rounded-xl text-xs sm:text-sm text-[#2D1B4E] focus:outline-none focus:ring-2 focus:ring-[#BF3A1B] focus:border-transparent transition-all font-medium"
              />
            </div>
            <p className="text-[11px] text-[#4A3F55]/70">
              Incluye clave internacional (ej. +52 para México, +1 para USA/Canadá). Se usa para generar los enlaces directos wa.me y webhooks.
            </p>
          </div>

          {/* Cargo / Rol Directivo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#4A3F55]" />
                <span>Puesto / Cargo Directivo</span>
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Creadora & Directora"
                className="w-full px-3 py-2 bg-[#FFF7EF] border border-[#493447]/20 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:ring-1 focus:ring-[#BF3A1B]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-[#4A3F55]" />
                <span>Empresa / Plataforma</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Lidacta"
                className="w-full px-3 py-2 bg-[#FFF7EF] border border-[#493447]/20 rounded-xl text-xs text-[#2D1B4E] focus:outline-none focus:ring-1 focus:ring-[#BF3A1B]"
              />
            </div>
          </div>

          {/* Live Preview of Asesoría 1:1 Recipient */}
          <div className="p-3.5 bg-gradient-to-br from-[#FFF7EF] via-[#FFD3BF]/30 to-[#F7B538]/20 border border-[#BF3A1B]/30 rounded-xl text-xs space-y-2 mt-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#BF3A1B]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Destino activo para solicitudes de Asesoría 1:1
              </span>
              <span className="text-[10px] text-[#2D1B4E] font-medium">Vinculación automática</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#2D1B4E]">
              <div className="bg-white/80 p-2 rounded-lg border border-[#493447]/10">
                <span className="text-[#4A3F55]/70 block text-[10px]">Correo de Notificación:</span>
                <strong className="text-[#BF3A1B] truncate block">{email || 'Sin correo configurado'}</strong>
              </div>
              <div className="bg-white/80 p-2 rounded-lg border border-[#493447]/10">
                <span className="text-[#4A3F55]/70 block text-[10px]">Enlace WhatsApp wa.me:</span>
                <strong className="text-[#246B2A] truncate block">
                  {cleanPhone ? `+${cleanPhone}` : 'Sin número configurado'}
                </strong>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#493447]/10">
            <button
              type="button"
              onClick={closeProfileModal}
              className="px-4 py-2.5 rounded-xl border border-[#493447]/20 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-[#FFF7EF] text-xs font-bold transition-colors cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white rounded-xl text-xs font-heading font-extrabold shadow-md transition-all cursor-pointer min-h-[44px] flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Datos de Perfil'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
