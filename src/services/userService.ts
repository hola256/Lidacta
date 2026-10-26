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
 * Completely eliminates browser localStorage isolation and ensures multi-device consistency
 * across mobile, desktop, tablets and private browsing sessions.
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
   * Fetch live, fresh users from the backend database (no cache).
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
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'Error al obtener usuarios del servidor'}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.users)) {
        return {
          success: true,
          users: data.users as UserProfile[],
          message: data.message,
        };
      }

      throw new Error(data.message || 'Respuesta inválida del servidor central');
    } catch (err: any) {
      console.error('[userService.getUsers] Error al consultar la BD central:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión con la base de datos central',
      };
    }
  }

  /**
   * Create a new user with real persistence in the backend database.
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

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          users: data.users || [],
          message: data.message || 'Error al crear usuario en la base de datos',
          error: data.message,
        };
      }

      return {
        success: true,
        user: data.user,
        users: data.users as UserProfile[],
        message: data.message || `Usuario ${data.user?.name} creado exitosamente.`,
      };
    } catch (err: any) {
      console.error('[userService.createUser] Error al guardar en el servidor:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión al intentar crear el usuario',
        message: 'No se pudo conectar con el servidor central para crear el usuario.',
      };
    }
  }

  /**
   * Update an existing user with real persistence in the backend database.
   * Tries PUT /api/users/:id and falls back to POST /api/users/update.
   */
  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<UserServiceResponse> {
    try {
      let response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(updates),
      });

      // If PUT is not supported or errors with 404/405, try fallback POST /api/users/update
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

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          users: data.users || [],
          message: data.message || 'Error al actualizar usuario en la base de datos',
          error: data.message,
        };
      }

      return {
        success: true,
        user: data.user,
        users: data.users as UserProfile[],
        message: data.message || 'Usuario actualizado y persistido en la base de datos central.',
      };
    } catch (err: any) {
      console.error('[userService.updateUser] Error al enviar actualización:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión al intentar actualizar el usuario',
        message: 'No se pudo conectar con el servidor central para guardar los cambios.',
      };
    }
  }

  /**
   * Delete a user with real persistence in the backend database.
   */
  async deleteUser(userId: string): Promise<UserServiceResponse> {
    try {
      let response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      });

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

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          users: data.users || [],
          message: data.message || 'Error al eliminar usuario en la base de datos',
          error: data.message,
        };
      }

      return {
        success: true,
        deletedId: data.deletedId || userId,
        users: data.users as UserProfile[],
        message: data.message || 'Usuario eliminado exitosamente del servidor central.',
      };
    } catch (err: any) {
      console.error('[userService.deleteUser] Error al eliminar en el servidor:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión al eliminar usuario',
        message: 'No se pudo conectar con el servidor central para eliminar el usuario.',
      };
    }
  }

  /**
   * Complete leader or user profile with real persistence in the backend database.
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

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          users: data.users || [],
          message: data.message || 'Error al completar el perfil en la base de datos central',
          error: data.message,
        };
      }

      return {
        success: true,
        user: data.user,
        users: data.users as UserProfile[],
        message: data.message || 'Perfil completado y sincronizado globalmente.',
      };
    } catch (err: any) {
      console.error('[userService.completeProfile] Error en la petición:', err);
      return {
        success: false,
        users: [],
        error: err?.message || 'Error de conexión al sincronizar el perfil',
        message: 'No se pudo sincronizar el perfil con el servidor central.',
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
          dbSource: data.databaseFile || 'server_users_db.json',
        };
      }

      // Fallback ping to /api/users
      const usersRes = await fetch('/api/users', { cache: 'no-store' });
      const latencyMs2 = Math.round(performance.now() - startTime);
      if (usersRes.ok) {
        const uData = await usersRes.json();
        return {
          connected: true,
          latencyMs: latencyMs2,
          lastChecked: new Date(),
          usersCount: Array.isArray(uData.users) ? uData.users.length : 0,
          dbSource: 'server_users_db.json',
        };
      }

      return {
        connected: false,
        latencyMs: latencyMs2,
        lastChecked: new Date(),
        usersCount: 0,
        dbSource: 'Desconectado',
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
