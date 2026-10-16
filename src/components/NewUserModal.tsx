import React, { useState } from 'react';
import { useLidacta } from '../context/LidactaContext';
import { UserRole } from '../types/lidacta';
import { X, UserPlus, ShieldCheck } from 'lucide-react';

export const NewUserModal: React.FC = () => {
  const { showNewUserModal, setShowNewUserModal, createNewUser, companies } = useLidacta();

  const [role, setRole] = useState<UserRole>('leader');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState(companies[0]?.id || 'comp_nexus');
  const [position, setPosition] = useState('');
  const [area, setArea] = useState('');
  const [birthDate, setBirthDate] = useState('1988-06-15');
  const [directReports, setDirectReports] = useState(6);
  const [whatsapp, setWhatsapp] = useState('');

  if (!showNewUserModal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createNewUser({
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      role,
      companyId,
      position: position || (role === 'leader' ? 'Líder de Operaciones' : 'Gestión Humana'),
      area: area || 'Operaciones',
      birthDate,
      directReports: Number(directReports) || 0,
      whatsapp: whatsapp || '+52 55 1234 5678',
    });

    setShowNewUserModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2D1B4E]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white border border-[#493447]/20 rounded-2xl max-w-lg w-full shadow-2xl p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between border-b border-[#493447]/10 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#BF3A1B] shrink-0" />
            <h2 className="font-heading font-bold text-base sm:text-lg text-[#2D1B4E]">
              Registro de Nuevo Perfil en Lidacta
            </h2>
          </div>
          <button
            onClick={() => setShowNewUserModal(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#4A3F55] hover:text-[#2D1B4E] rounded-xl cursor-pointer active:scale-95"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Role selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#2D1B4E] block">Tipo de Perfil:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'leader', label: 'Líder (Principal)' },
                { id: 'hr', label: 'Recursos Humanos' },
                { id: 'admin', label: 'Administrador' },
              ].map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setRole(r.id as UserRole)}
                  className={`min-h-[44px] p-2 rounded-xl border text-center font-bold transition-all cursor-pointer flex items-center justify-center active:scale-98 ${
                    role === r.id
                      ? 'bg-[#BF3A1B] text-white border-[#BF3A1B] shadow-xs'
                      : 'bg-[#FFF7EF] text-[#4A3F55] border-[#493447]/10 hover:border-[#BF3A1B]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E]">Nombre Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Roberto Gómez"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-[#2D1B4E]">Empresa *</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E]">Puesto *</label>
              <input
                type="text"
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Ej. Líder de Producción"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
              />
            </div>

            {role === 'leader' && (
              <div className="space-y-1">
                <label className="font-bold text-[#2D1B4E]">Área *</label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Ej. Manufactura"
                  className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="font-bold text-[#2D1B4E]">Fecha de Nacimiento</label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
              />
            </div>

            {role === 'leader' && (
              <div className="space-y-1">
                <label className="font-bold text-[#2D1B4E]">Personas a Cargo</label>
                <input
                  type="number"
                  value={directReports}
                  onChange={(e) => setDirectReports(Number(e.target.value))}
                  className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
                />
              </div>
            )}

            <div className="space-y-1 sm:col-span-2">
              <label className="font-bold text-[#2D1B4E]">Número de WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+52 55 0000 0000"
                className="w-full p-2.5 min-h-[44px] bg-[#FFF7EF]/50 border border-[#493447]/15 rounded-xl text-xs text-[#2D1B4E]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#493447]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-[#4A3F55]/70 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#BF3A1B] shrink-0" />
              Datos protegidos bajo confidencialidad
            </span>
            <button
              type="submit"
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-[#BF3A1B] hover:bg-[#a63014] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center active:scale-95"
            >
              Completar Registro
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
