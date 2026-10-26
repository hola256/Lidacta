import React, { useState, useEffect } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { CompanyContext, UserProfile, UserRole } from '../types/lidacta';
import {
  X,
  UserPlus,
  Pencil,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Building2,
  Briefcase,
  Mail,
  User,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Check,
  Layers,
} from 'lucide-react';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: CompanyContext[];
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, companies }) => {
  const { createUser, allUsers } = useLidacta();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('leader');
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'comp_nexus');
  const [position, setPosition] = useState('');
  const [area, setArea] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setRole('leader');
      setCompanyId(companies[0]?.id || 'comp_nexus');
      setPosition('');
      setArea('');
      setWhatsapp('');
      setStatus('active');
      setPassword('');
      setShowPassword(false);
      setValidationError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, companies]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setValidationError('Por favor ingresa el nombre completo del usuario.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setValidationError('Por favor ingresa un correo electrónico corporativo válido.');
      return;
    }

    // Check duplicate email
    const exists = allUsers.some((u) => u.email.toLowerCase() === cleanEmail);
    if (exists) {
      setValidationError('Ya existe un usuario registrado con este correo electrónico.');
      return;
    }

    if (!password || password.length < 6) {
      setValidationError('La contraseña inicial debe tener al menos 6 caracteres.');
      return;
    }

    const selectedComp = companies.find((c) => c.id === companyId) || companies[0];

    setIsSubmitting(true);
    try {
      const res = await createUser({
        name: cleanName,
        email: cleanEmail,
        role,
        companyId: selectedComp?.id || 'comp_nexus',
        companyName: selectedComp?.name || 'Industrias Nexus Automotriz',
        position: position.trim() || (role === 'leader' ? 'Líder de Equipo' : role === 'hr' ? 'Gestión Humana' : 'Administrador'),
        area: area.trim() || (role === 'leader' ? 'Operaciones' : ''),
        whatsapp: whatsapp.trim() || '+52 55 0000 0000',
        status,
        password: password.trim(),
      });

      if (res.success) {
        onClose();
      } else if (res.message) {
        setValidationError(res.message);
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Error inesperado al crear usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-[#493447]/20 rounded-2xl max-w-lg w-full shadow-2xl p-5 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#BF3A1B]/10 text-[#BF3A1B] flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2D1B4E]">
                Agregar Nuevo Usuario
              </h2>
              <p className="text-[11px] text-[#4A3F55]/70">
                Crea una cuenta en la base de datos central con acceso inmediato
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#4A3F55] hover:text-[#2D1B4E] rounded-xl cursor-pointer transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation error banner */}
        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#2D1B4E] block">
              Rol / Permisos del Usuario *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'leader', label: 'Líder', desc: 'Acompañamiento' },
                { id: 'hr', label: 'Recursos Humanos', desc: 'Métricas' },
                { id: 'admin', label: 'Administrador', desc: 'Control Total' },
              ].map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRole(r.id as UserRole)}
                  className={`min-h-[48px] p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    role === r.id
                      ? 'bg-[#2D1B4E] text-white border-[#2D1B4E] shadow-xs'
                      : 'bg-[#FFF7EF]/60 text-[#4A3F55] border-[#493447]/10 hover:border-[#BF3A1B]'
                  }`}
                >
                  <span className="font-bold text-xs">{r.label}</span>
                  <span className={`text-[9px] ${role === r.id ? 'text-white/70' : 'text-[#4A3F55]/60'}`}>
                    {r.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* General inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Roberto Gómez Silva"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B] focus:ring-1 focus:ring-[#BF3A1B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@empresa.com"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B] focus:ring-1 focus:ring-[#BF3A1B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Empresa Asignada *
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Puesto *
              </label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ej. Líder de Ensamble"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Área / Departamento
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Ej. Manufactura / Operaciones"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+52 55 1234 5678"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            {/* Initial Status Selector */}
            <div className="sm:col-span-2 space-y-1.5 pt-1">
              <label className="font-bold text-[#2D1B4E] block">Estado Inicial de la Cuenta *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={`min-h-[44px] p-2 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                    status === 'active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs'
                      : 'bg-white text-[#4A3F55] border-[#493447]/15 hover:border-emerald-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Activo (Con Acceso)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('inactive')}
                  className={`min-h-[44px] p-2 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                    status === 'inactive'
                      ? 'bg-amber-50 text-amber-900 border-amber-400 shadow-xs'
                      : 'bg-white text-[#4A3F55] border-[#493447]/15 hover:border-amber-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Inactivo (Pausado)</span>
                </button>
              </div>
            </div>

            {/* Initial Password */}
            <div className="sm:col-span-2 space-y-1 pt-1">
              <label className="font-bold text-[#2D1B4E] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#BF3A1B]" />
                  Contraseña Inicial *
                </span>
                <span className="text-[10px] text-[#4A3F55]/60 font-normal">Mínimo 6 caracteres</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce una contraseña segura"
                  className="w-full p-2.5 pr-10 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4A3F55] hover:text-[#2D1B4E] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#493447]/10 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 border border-[#493447]/20 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Guardando en Servidor...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar y Crear Usuario</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EditUserModalProps {
  user: UserProfile | null;
  onClose: () => void;
  companies: CompanyContext[];
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, companies }) => {
  const { updateUser, allUsers } = useLidacta();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('leader');
  const [companyId, setCompanyId] = useState('');
  const [position, setPosition] = useState('');
  const [area, setArea] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'leader');
      setCompanyId(user.companyId || companies[0]?.id || 'comp_nexus');
      setPosition(user.position || '');
      setArea(user.area || '');
      setWhatsapp(user.whatsapp || '');
      setStatus(user.status || 'active');
      setNewPassword('');
      setShowPassword(false);
      setValidationError(null);
      setIsSubmitting(false);
    }
  }, [user, companies]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setValidationError('El nombre completo es obligatorio.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setValidationError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    // Check email uniqueness if changed
    if (cleanEmail !== user.email.toLowerCase()) {
      const duplicate = allUsers.some(
        (u) => u.id !== user.id && u.email.toLowerCase() === cleanEmail
      );
      if (duplicate) {
        setValidationError('Otro usuario ya tiene registrado este correo electrónico.');
        return;
      }
    }

    if (newPassword && newPassword.length < 6) {
      setValidationError('Si decides restablecer la contraseña, debe tener al menos 6 caracteres.');
      return;
    }

    const selectedComp = companies.find((c) => c.id === companyId) || companies[0];

    setIsSubmitting(true);
    try {
      const updates: Partial<UserProfile> = {
        name: cleanName,
        email: cleanEmail,
        role,
        companyId: selectedComp?.id || user.companyId,
        companyName: selectedComp?.name || user.companyName,
        position: position.trim() || user.position,
        area: area.trim(),
        whatsapp: whatsapp.trim(),
        status,
      };

      if (newPassword && newPassword.trim().length >= 6) {
        updates.password = newPassword.trim();
      }

      const res = await updateUser(user.id, updates);
      if (res.success) {
        onClose();
      } else if (res.message) {
        setValidationError(res.message);
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Error al actualizar usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-[#493447]/20 rounded-2xl max-w-lg w-full shadow-2xl p-5 sm:p-7 space-y-4 max-h-[92vh] overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2D1B4E]/10 text-[#2D1B4E] flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5 text-[#2D1B4E]" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2D1B4E]">
                Editar Usuario
              </h2>
              <p className="text-[11px] text-[#4A3F55]/70 truncate max-w-[280px]">
                {user.name} ({user.email})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#4A3F55] hover:text-[#2D1B4E] rounded-xl cursor-pointer transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#2D1B4E] block">
              Rol / Permisos de la Cuenta:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'leader', label: 'Líder', desc: 'Acompañamiento' },
                { id: 'hr', label: 'Recursos Humanos', desc: 'Indicadores' },
                { id: 'admin', label: 'Administrador', desc: 'Acceso Total' },
              ].map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRole(r.id as UserRole)}
                  className={`min-h-[48px] p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    role === r.id
                      ? 'bg-[#2D1B4E] text-white border-[#2D1B4E] shadow-xs'
                      : 'bg-[#FFF7EF]/60 text-[#4A3F55] border-[#493447]/10 hover:border-[#BF3A1B]'
                  }`}
                >
                  <span className="font-bold text-xs">{r.label}</span>
                  <span className={`text-[9px] ${role === r.id ? 'text-white/70' : 'text-[#4A3F55]/60'}`}>
                    {r.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* General inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Empresa *
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Puesto *
              </label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Área / Departamento
              </label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="font-bold text-[#2D1B4E] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#BF3A1B]" />
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
              />
            </div>

            {/* Status Switcher */}
            <div className="sm:col-span-2 space-y-1.5 pt-1">
              <label className="font-bold text-[#2D1B4E] block">Estado de la Cuenta:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus('active')}
                  className={`min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                    status === 'active'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs ring-1 ring-emerald-300'
                      : 'bg-white text-[#4A3F55] border-[#493447]/15 hover:border-emerald-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Activo (Con Acceso)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('inactive')}
                  className={`min-h-[44px] p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold cursor-pointer transition-all ${
                    status === 'inactive'
                      ? 'bg-amber-50 text-amber-900 border-amber-400 shadow-xs ring-1 ring-amber-300'
                      : 'bg-white text-[#4A3F55] border-[#493447]/15 hover:border-amber-300'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Inactivo (Pausado)</span>
                </button>
              </div>
            </div>

            {/* Optional Password Reset */}
            <div className="sm:col-span-2 space-y-1 pt-1">
              <label className="font-bold text-[#2D1B4E] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#BF3A1B]" />
                  Restablecer Contraseña (Opcional)
                </span>
                <span className="text-[10px] text-[#4A3F55]/60 font-normal">
                  Dejar en blanco para no modificar
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Introduce nueva contraseña (opcional)"
                  className="w-full p-2.5 pr-10 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E] focus:outline-hidden focus:border-[#BF3A1B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#4A3F55] hover:text-[#2D1B4E] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-[#493447]/10 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 border border-[#493447]/20 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2 bg-[#2D1B4E] hover:bg-[#3D2569] text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Guardando Cambios...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteUserModalProps {
  user: UserProfile | null;
  onClose: () => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose }) => {
  const { deleteUser } = useLidacta();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user) return null;

  const isProtectedAdmin = user.id === 'user_admin_tania';

  const handleConfirmDelete = async () => {
    if (isProtectedAdmin) {
      setErrorMsg('No es posible eliminar la cuenta principal de administración (Tania Padierna).');
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);
    try {
      const res = await deleteUser(user.id);
      if (res.success) {
        onClose();
      } else if (res.message) {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al eliminar usuario');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-[#493447]/20 rounded-2xl max-w-md w-full shadow-2xl p-5 sm:p-7 space-y-4 my-auto">
        {/* Warning Icon & Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-base sm:text-lg text-[#2D1B4E]">
              ¿Eliminar usuario definitivamente?
            </h2>
            <p className="text-xs text-[#4A3F55]/70 mt-0.5">
              Esta acción no se puede deshacer y borrará el registro de la base de datos central.
            </p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3.5 bg-[#FFF7EF] border border-[#FFD3BF] rounded-xl space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[#2D1B4E]">{user.name}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#FFD3BF] text-[#BF3A1B]">
              {user.role}
            </span>
          </div>
          <p className="text-[#4A3F55]">{user.email}</p>
          <p className="text-[11px] text-[#4A3F55]/70">
            {user.companyName} · {user.position}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isProtectedAdmin ? (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Esta cuenta es la administradora central de Lidacta y está protegida contra eliminación.</span>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-full sm:w-auto min-h-[44px] px-4 py-2 border border-[#493447]/20 text-[#4A3F55] hover:text-[#2D1B4E] hover:bg-slate-50 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          {!isProtectedAdmin && (
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isDeleting ? (
                <span>Eliminando del Servidor...</span>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Sí, Eliminar Usuario</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
