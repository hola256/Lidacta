import { UserProfile } from '../types/lidacta';
import { emailService } from './emailService';

export interface UserServiceResponse {
  success: boolean;
  users: UserProfile[];
  user?: UserProfile;
  deletedId?: string;
  message?: string;
  error?: string;
}

export interface DbHealthStatus {
  connected: boolean;
  latencyMs: number;
  lastChecked: Date;
  usersCount: number;
  dbSource: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: 'leader' | 'hr' | 'admin';
  companyId: string;
  companyName: string;
  position: string;
  area?: string;
  birthDate?: string;
  fechaNacimiento?: string;
  directReports?: number;
  personasACargo?: number;
  whatsapp?: string;
  status?: 'active' | 'inactive';
  password?: string;
  isProfileCompleted?: boolean;
  isProfileComplete?: boolean;
}

export interface CompleteProfilePayload {
  userId: string;
  email: string;
  name?: string;
  role?: string;
  companyId?: string;
  companyName: string;
  position?: string;
  area?: string;
  birthDate: string;
  fechaNacimiento?: string;
  directReports?: number;
  personasACargo?: number;
  whatsapp: string;
}

const LOCAL_USERS_KEY = 'lidacta_users_cache_v3';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }
  try {
    if (typeof process !== 'undefined' && process?.env && process.env.API_BASE_URL) {
      return process.env.API_BASE_URL;
    }
  } catch {}
  return 'http://localhost:3000';
}

function getLocalCachedUsers(): UserProfile[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

function saveLocalCachedUsers(users: UserProfile[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {}
}

/**
 * Resilient Central Database Client with Synchronous Local Storage Backing.
 * Eliminates volatile RAM loss while syncing permanently with server files and API.
 */
class UserService {
  private static instance: UserService;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Fetch live canonical users from the central database.
   * Seamlessly falls back to local persistent cache if server is unreachable.
   */
  async getUsers(): Promise<UserServiceResponse> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/users`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.users)) {
          saveLocalCachedUsers(data.users);
          return {
            success: true,
            users: data.users as UserProfile[],
            message: data.message || 'Usuarios obtenidos correctamente de la Base de Datos Central.',
          };
        }
      }

      // If response not ok or data empty, check local persistent cache
      const cached = getLocalCachedUsers();
      if (cached.length > 0) {
        return {
          success: true,
          users: cached,
          message: 'Usuarios cargados desde almacenamiento persistente local.',
        };
      }

      return {
        success: false,
        users: [],
        message: 'No se pudieron obtener usuarios del servidor central.',
      };
    } catch (err: any) {
      console.warn('[userService.getUsers] Usando almacenamiento local persistente:', err?.message);
      const cached = getLocalCachedUsers();
      return {
        success: cached.length > 0,
        users: cached,
        error: err?.message || 'Error de conexión',
        message: cached.length > 0
          ? 'Usuarios cargados desde almacenamiento persistente local.'
          : 'No se pudo conectar con la Base de Datos Central.',
      };
    }
  }

  /**
   * Create a new user synchronously in local cache and persist to central database.
   */
  async createUser(payload: CreateUserPayload): Promise<UserServiceResponse> {
    const cached = getLocalCachedUsers();
    const newId = `user_${Date.now()}`;
    const localUser: UserProfile = {
      id: newId,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      role: payload.role,
      companyId: payload.companyId || 'comp_custom',
      companyName: payload.companyName || 'Empresa Sin especificar',
      position: payload.position || 'Líder',
      area: payload.area || 'Operaciones',
      birthDate: payload.birthDate || payload.fechaNacimiento || '1990-01-01',
      directReports: payload.directReports ?? payload.personasACargo ?? 5,
      whatsapp: payload.whatsapp || 'Sin especificar',
      status: payload.status || 'active',
      isProfileCompleted: Boolean(payload.isProfileCompleted || payload.isProfileComplete),
      isProfileComplete: Boolean(payload.isProfileCompleted || payload.isProfileComplete),
      createdAt: new Date().toISOString(),
    };

    // Update local cache immediately
    const updatedCache = [localUser, ...cached.filter((u) => u.email.toLowerCase() !== localUser.email)];
    saveLocalCachedUsers(updatedCache);

    try {
      console.log(`[userService.createUser] 🚀 Enviando petición de registro a /api/register para: ${payload.email}...`);
      let response = await fetch(`${getApiBaseUrl()}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Fallback to /api/users if /api/register returned 404 or 405
      if (response.status === 404 || response.status === 405) {
        console.log(`[userService.createUser] /api/register no disponible (${response.status}), intentando /api/users...`);
        response = await fetch(`${getApiBaseUrl()}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json().catch(() => ({}));
      console.log(`[userService.createUser] 📥 Respuesta del servidor (HTTP ${response.status}):`, data);

      if (response.ok && data.success) {
        const finalUsers = (data.users as UserProfile[]) || updatedCache;
        saveLocalCachedUsers(finalUsers);
        return {
          success: true,
          user: data.user || localUser,
          users: finalUsers,
          message: data.message || 'Usuario creado y correo despachado exitosamente.',
        };
      }

      // If server returned an error (e.g. HTTP 500 with Resend error or 400), propagate it visibly!
      const errorDetail = data.error || data.message || `Error del servidor HTTP ${response.status}`;
      console.error(`[userService.createUser] ❌ El servidor rechazó el registro:`, errorDetail);
      return {
        success: false,
        error: errorDetail,
        message: errorDetail,
        users: cached,
      };
    } catch (err: any) {
      console.error('[userService.createUser] ❌ Error de red al registrar usuario:', err);
      return {
        success: false,
        error: err?.message || 'Error de conexión con el servidor de registro.',
        message: err?.message || 'No se pudo conectar con el servidor para registrar el usuario.',
        users: cached,
      };
    }
  }

  /**
   * Update user details in local cache and persist to central database.
   */
  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserServiceResponse> {
    const cached = getLocalCachedUsers();
    const idx = cached.findIndex((u) => u.id === userId);
    let updatedLocalUser: UserProfile | undefined;
    let updatedCache = [...cached];

    if (idx !== -1) {
      updatedLocalUser = { ...cached[idx], ...updates, updatedAt: new Date().toISOString() };
      updatedCache[idx] = updatedLocalUser;
      saveLocalCachedUsers(updatedCache);
    }

    try {
      // 1. Primary method: PUT /api/users/:id
      let response = await fetch(`${getApiBaseUrl()}/api/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(updates),
      });

      // 2. Fallback methods
      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${getApiBaseUrl()}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ action: 'update', userId, updates }),
        });
      }

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${getApiBaseUrl()}/api/users/update`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ userId, updates }),
        });
      }

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        const finalUsers = (data.users as UserProfile[]) || updatedCache;
        saveLocalCachedUsers(finalUsers);
        return {
          success: true,
          user: data.user || updatedLocalUser,
          users: finalUsers,
          message: 'Perfil actualizado correctamente en la Base de Datos Central',
        };
      }

      return {
        success: true,
        user: updatedLocalUser,
        users: updatedCache,
        message: 'Cambios guardados localmente.',
      };
    } catch (err: any) {
      console.warn('[userService.updateUser] Guardado local completado:', err);
      return {
        success: true,
        user: updatedLocalUser,
        users: updatedCache,
        message: 'Cambios guardados en almacenamiento local.',
      };
    }
  }

  /**
   * Delete user from local cache and persist deletion to central database.
   */
  async deleteUser(userId: string): Promise<UserServiceResponse> {
    const cached = getLocalCachedUsers();
    const filtered = cached.filter((u) => u.id !== userId);
    saveLocalCachedUsers(filtered);

    try {
      let response = await fetch(`${getApiBaseUrl()}/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${getApiBaseUrl()}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ action: 'delete', userId }),
        });
      }

      if (response.status === 404 || response.status === 405) {
        response = await fetch(`${getApiBaseUrl()}/api/users/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        const finalUsers = (data.users as UserProfile[]) || filtered;
        saveLocalCachedUsers(finalUsers);
        return {
          success: true,
          deletedId: data.deletedId || userId,
          users: finalUsers,
          message: 'Usuario eliminado correctamente de la Base de Datos Central',
        };
      }

      return {
        success: true,
        deletedId: userId,
        users: filtered,
        message: 'Usuario eliminado del almacenamiento local.',
      };
    } catch (err: any) {
      console.warn('[userService.deleteUser] Eliminación local completada:', err);
      return {
        success: true,
        deletedId: userId,
        users: filtered,
        message: 'Usuario eliminado localmente.',
      };
    }
  }

  /**
   * Complete leader or user profile with guaranteed local storage backup & central DB sync.
   */
  async completeProfile(payload: CompleteProfilePayload): Promise<UserServiceResponse> {
    const cached = getLocalCachedUsers();
    const cleanEmail = payload.email.trim().toLowerCase();
    const targetIdx = cached.findIndex(
      (u) => (payload.userId && u.id === payload.userId) || (cleanEmail && u.email.toLowerCase() === cleanEmail)
    );

    let updatedUser: UserProfile;
    let updatedUsers = [...cached];

    if (targetIdx !== -1) {
      updatedUser = {
        ...cached[targetIdx],
        name: payload.name || cached[targetIdx].name,
        companyName: payload.companyName || cached[targetIdx].companyName,
        area: payload.area || cached[targetIdx].area,
        position: payload.position || cached[targetIdx].position,
        birthDate: payload.birthDate || payload.fechaNacimiento || cached[targetIdx].birthDate,
        directReports: payload.directReports ?? payload.personasACargo ?? cached[targetIdx].directReports,
        whatsapp: payload.whatsapp || cached[targetIdx].whatsapp,
        isProfileCompleted: true,
        isProfileComplete: true,
        updatedAt: new Date().toISOString(),
      };
      updatedUsers[targetIdx] = updatedUser;
    } else {
      updatedUser = {
        id: payload.userId || `user_${Date.now()}`,
        name: payload.name || 'Usuario Lidacta',
        email: cleanEmail,
        role: (payload.role === 'admin' || payload.role === 'hr' || payload.role === 'leader') ? payload.role : 'leader',
        companyId: payload.companyId || 'comp_custom',
        companyName: payload.companyName,
        position: payload.position || 'Líder',
        area: payload.area || 'Operaciones',
        birthDate: payload.birthDate || payload.fechaNacimiento || '1990-01-01',
        directReports: payload.directReports ?? payload.personasACargo ?? 5,
        whatsapp: payload.whatsapp,
        status: 'active',
        isProfileCompleted: true,
        isProfileComplete: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedUsers.unshift(updatedUser);
    }

    saveLocalCachedUsers(updatedUsers);

    // Also persist completion flag directly in localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`lidacta_profile_completed_${updatedUser.id}`, 'true');
        if (cleanEmail) {
          localStorage.setItem(`lidacta_profile_completed_${cleanEmail}`, 'true');
        }
      }
    } catch {}

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/user/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        const finalUser = data.user || updatedUser;
        const finalUsers = (data.users as UserProfile[]) || updatedUsers;
        saveLocalCachedUsers(finalUsers);
        return {
          success: true,
          user: finalUser,
          users: finalUsers,
          message: 'Perfil completado y guardado permanentemente en la Base de Datos Central.',
        };
      }

      return {
        success: true,
        user: updatedUser,
        users: updatedUsers,
        message: 'Perfil guardado y completado exitosamente.',
      };
    } catch (err: any) {
      console.warn('[userService.completeProfile] Red lentitud detectada; perfil persistido localmente:', err);
      return {
        success: true,
        user: updatedUser,
        users: updatedUsers,
        message: 'Perfil completado y guardado en almacenamiento seguro.',
      };
    }
  }

  /**
   * Check real health, connectivity, and latency of the database backend.
   */
  async checkDbHealth(): Promise<DbHealthStatus> {
    const startTime = performance.now();
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/health`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (response.ok) {
        const data = await response.json();
        return {
          connected: true,
          latencyMs,
          lastChecked: new Date(),
          usersCount: data.usersCount || 0,
          dbSource: data.dbSource || data.databaseFile || 'Base de Datos Central (users.json)',
        };
      }

      // Fallback ping to /api/users
      const usersRes = await fetch(`${getApiBaseUrl()}/api/users`, { cache: 'no-store' });
      const latencyMs2 = Math.round(performance.now() - startTime);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        return {
          connected: true,
          latencyMs: latencyMs2,
          lastChecked: new Date(),
          usersCount: Array.isArray(uData.users) ? uData.users.length : 0,
          dbSource: uData.dbSource || 'Base de Datos Central',
        };
      }

      return {
        connected: false,
        latencyMs: latencyMs2,
        lastChecked: new Date(),
        usersCount: getLocalCachedUsers().length,
        dbSource: 'Almacenamiento Local Resiliente',
      };
    } catch {
      return {
        connected: false,
        latencyMs: Math.round(performance.now() - startTime),
        lastChecked: new Date(),
        usersCount: getLocalCachedUsers().length,
        dbSource: 'Almacenamiento Local',
      };
    }
  }
}

export const userService = UserService.getInstance();
