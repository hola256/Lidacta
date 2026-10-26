import { UserProfile } from '../types/lidacta';

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
  directReports?: number;
  whatsapp?: string;
  status?: 'active' | 'inactive';
  password?: string;
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
  directReports?: number;
  whatsapp: string;
}

/**
 * Real HTTP REST Client for Centralized Database Operations.
 * Disables all localStorage simulation for User Directory.
 * Exclusively executes real HTTP/API requests against the central server/database.
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
   */
  async getUsers(): Promise<UserServiceResponse> {
    try {
      const response = await fetch('/api/users', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Error al consultar la Base de Datos Central`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.users)) {
        return {
          success: true,
          users: data.users as UserProfile[],
          message: data.message || 'Usuarios obtenidos correctamente de la Base de Datos Central.',
        };
      }

      throw new Error(data.message || 'Formato de respuesta inválido del servidor central.');
    } catch (err: any) {
      console.error('[userService.getUsers] Error en la Base de Datos Central:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión con la Base de Datos Central',
        message: 'No se pudo conectar con la Base de Datos Central.',
      };
    }
  }

  /**
   * Create a new user exclusively in the central database.
   */
  async createUser(payload: CreateUserPayload): Promise<UserServiceResponse> {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        return {
          success: false,
          users: [],
          message: data.message || 'Error al crear usuario en la Base de Datos Central.',
          error: data.message,
        };
      }

      return {
        success: true,
        user: data.user,
        users: (data.users as UserProfile[]) || [],
        message: 'Usuario creado correctamente en la Base de Datos Central',
      };
    } catch (err: any) {
      console.error('[userService.createUser] Error al conectar con el servidor central:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión',
        message: 'No se pudo conectar con la Base de Datos Central para crear el usuario.',
      };
    }
  }

  /**
   * Update user details exclusively in the central database.
   */
  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserServiceResponse> {
    try {
      // 1. Primary method: PUT /api/users/:id
      let response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(updates),
      });

      // 2. Fallback method for serverless hosts: POST /api/users with action: 'update'
      if (response.status === 404 || response.status === 405) {
        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ action: 'update', userId, updates }),
        });
      }

      // 3. Fallback method: POST /api/users/update
      if (response.status === 404 || response.status === 405) {
        response = await fetch('/api/users/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ userId, updates }),
        });
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        return {
          success: false,
          users: [],
          message: data.message || 'Error al actualizar usuario en la Base de Datos Central.',
          error: data.message,
        };
      }

      return {
        success: true,
        user: data.user,
        users: (data.users as UserProfile[]) || [],
        message: 'Perfil actualizado correctamente en la Base de Datos Central',
      };
    } catch (err: any) {
      console.error('[userService.updateUser] Error al conectar con el servidor central:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión',
        message: 'No se pudo conectar con la Base de Datos Central para guardar los cambios.',
      };
    }
  }

  /**
   * Delete user exclusively in the central database.
   */
  async deleteUser(userId: string): Promise<UserServiceResponse> {
    try {
      let response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 404 || response.status === 405) {
        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ action: 'delete', userId }),
        });
      }

      if (response.status === 404 || response.status === 405) {
        response = await fetch('/api/users/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ userId }),
        });
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        return {
          success: false,
          users: [],
          message: data.message || 'Error al eliminar usuario en la Base de Datos Central.',
          error: data.message,
        };
      }

      return {
        success: true,
        deletedId: data.deletedId || userId,
        users: (data.users as UserProfile[]) || [],
        message: 'Usuario eliminado correctamente de la Base de Datos Central',
      };
    } catch (err: any) {
      console.error('[userService.deleteUser] Error al conectar con el servidor central:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión',
        message: 'No se pudo conectar con la Base de Datos Central para eliminar el usuario.',
      };
    }
  }

  /**
   * Complete leader or user profile exclusively in the central database.
   */
  async completeProfile(payload: CompleteProfilePayload): Promise<UserServiceResponse> {
    try {
      const response = await fetch('/api/user/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        return {
          success: false,
          users: [],
          message: data.message || 'Error al completar el perfil en la Base de Datos Central.',
          error: data.message,
        };
      }

      return {
        success: true,
        user: data.user,
        users: (data.users as UserProfile[]) || [],
        message: 'Perfil actualizado correctamente en la Base de Datos Central',
      };
    } catch (err: any) {
      console.error('[userService.completeProfile] Error en la Base de Datos Central:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión',
        message: 'No se pudo sincronizar el perfil con la Base de Datos Central.',
      };
    }
  }

  /**
   * Check real health, connectivity, and latency of the database backend.
   */
  async checkDbHealth(): Promise<DbHealthStatus> {
    const startTime = performance.now();
    try {
      const response = await fetch('/api/health', {
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
          dbSource: data.dbSource || data.databaseFile || 'Base de Datos Central',
        };
      }

      // Try pinging /api/users
      const usersRes = await fetch('/api/users', { cache: 'no-store' });
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
        usersCount: 0,
        dbSource: 'Sin conexión con la Base de Datos Central',
      };
    } catch {
      return {
        connected: false,
        latencyMs: Math.round(performance.now() - startTime),
        lastChecked: new Date(),
        usersCount: 0,
        dbSource: 'Sin conexión',
      };
    }
  }
}

export const userService = UserService.getInstance();
