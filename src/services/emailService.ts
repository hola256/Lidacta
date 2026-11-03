import { UserProfile } from '../types/lidacta';

export interface EmailServiceOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  type?: string;
  userId?: string;
  name?: string;
  role?: string;
  companyName?: string;
  inviteUrl?: string;
}

export interface EmailServiceResult {
  success: boolean;
  message?: string;
  emailId?: string;
  error?: string;
  realSent?: boolean;
}

function getEnvVar(key: string, defaultValue: string): string {
  try {
    if (typeof process !== 'undefined' && process?.env && process.env[key]) {
      return process.env[key]!;
    }
  } catch {}
  return defaultValue;
}

export const DEFAULT_FROM = getEnvVar('RESEND_FROM_EMAIL', 'Lidacta <notificaciones@taniapadierna.com>');
export const DEFAULT_REPLY_TO = getEnvVar('RESEND_REPLY_TO', 'hola@taniapadierna.com');

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

/**
 * Servicio Centralizado de Correos Transaccionales Lidacta (Resend).
 * Maneja fallbacks seguros y captura de errores sin interrumpir la creación de usuarios.
 */
export class EmailService {
  private static instance: EmailService;

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Envía un correo de bienvenida oficial con await y try/catch que registra fallos sin detener el registro.
   */
  async sendWelcomeEmail(user: Partial<UserProfile>): Promise<EmailServiceResult> {
    if (!user.email) {
      return { success: false, error: 'El usuario no tiene correo electrónico válido.' };
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          email: user.email,
          name: user.name || 'Líder Lidacta',
          role: user.role || 'leader',
          companyName: user.companyName || 'Industrias Nexus Automotriz',
          type: 'welcome',
          subject: `¡Te damos la bienvenida a Lidacta, ${user.name || 'Líder'}!`,
          replyTo: 'hola@taniapadierna.com',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        return {
          success: true,
          emailId: data.emailId || data.id,
          realSent: data.realSent ?? true,
          message: data.message || 'Correo de bienvenida enviado exitosamente.',
        };
      }

      console.error('Resend delivery failed:', data.error || data.message || 'Error en servidor');
      return {
        success: false,
        error: data.error || data.message || 'Error al despachar correo de bienvenida',
      };
    } catch (error) {
      console.error('Resend delivery failed:', error);
      return {
        success: false,
        error: (error as any)?.message || 'Error de red al entregar correo',
      };
    }
  }

  /**
   * Despacho genérico de correo transaccional.
   */
  async sendEmail(options: EmailServiceOptions): Promise<EmailServiceResult> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ...options,
          from: DEFAULT_FROM,
          replyTo: 'hola@taniapadierna.com',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        return {
          success: true,
          emailId: data.emailId || data.id,
          realSent: data.realSent ?? true,
          message: data.message,
        };
      }

      console.error('Resend delivery failed:', data.error || data.message);
      return {
        success: false,
        error: data.error || data.message,
      };
    } catch (error) {
      console.error('Resend delivery failed:', error);
      return {
        success: false,
        error: (error as any)?.message,
      };
    }
  }

  /**
   * Envía correo de acompañamiento de Etapa 5 (48 horas) al Líder.
   */
  async sendStage5FollowUp48h(params: {
    leaderEmail: string;
    leaderName: string;
    companyName?: string;
    challengeTitle?: string;
    actionPlan?: any;
  }): Promise<EmailServiceResult> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: params.leaderEmail,
          email: params.leaderEmail,
          name: params.leaderName,
          companyName: params.companyName,
          challengeTitle: params.challengeTitle,
          actionPlan: params.actionPlan,
          type: 'stage5_48h',
          subject: 'Apoyo continuo para revisar el primer paso de tu compromiso en Lidacta',
          replyTo: 'hola@taniapadierna.com',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        return {
          success: true,
          emailId: data.emailId || data.id,
          realSent: data.realSent ?? true,
          message: data.message || 'Correo de apoyo 48h enviado exitosamente.',
        };
      }
      return {
        success: false,
        error: data.error || data.message || 'Error al despachar correo 48h',
      };
    } catch (error) {
      console.error('Error despachando correo 48h:', error);
      return {
        success: false,
        error: (error as any)?.message || 'Error de red en correo 48h',
      };
    }
  }

  /**
   * Envía correo de acompañamiento de Etapa 5 (5 días) al Líder.
   */
  async sendStage5FollowUp5d(params: {
    leaderEmail: string;
    leaderName: string;
    companyName?: string;
    challengeTitle?: string;
    actionPlan?: any;
  }): Promise<EmailServiceResult> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: params.leaderEmail,
          email: params.leaderEmail,
          name: params.leaderName,
          companyName: params.companyName,
          challengeTitle: params.challengeTitle,
          actionPlan: params.actionPlan,
          type: 'stage5_5d',
          subject: 'Seguimiento de tu plan de acción en Lidacta: consolidando avances hacia la Etapa 6',
          replyTo: 'hola@taniapadierna.com',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        return {
          success: true,
          emailId: data.emailId || data.id,
          realSent: data.realSent ?? true,
          message: data.message || 'Correo de seguimiento 5d enviado exitosamente.',
        };
      }
      return {
        success: false,
        error: data.error || data.message || 'Error al despachar correo 5d',
      };
    } catch (error) {
      console.error('Error despachando correo 5d:', error);
      return {
        success: false,
        error: (error as any)?.message || 'Error de red en correo 5d',
      };
    }
  }

  /**
   * Envía alerta de inactividad (Día 8) a la Administradora (hola@taniapadierna.com).
   */
  async sendStage5InactivityAlertToAdmin(params: {
    leaderEmail: string;
    leaderName: string;
    companyName?: string;
    challengeTitle?: string;
    leaderPosition?: string;
    leaderArea?: string;
    leaderWhatsapp?: string;
    lastActiveAt?: string;
    lastActiveFormatted?: string;
    actionPlan?: any;
  }): Promise<EmailServiceResult> {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: 'hola@taniapadierna.com',
          email: 'hola@taniapadierna.com',
          leaderEmail: params.leaderEmail,
          leaderName: params.leaderName,
          companyName: params.companyName,
          challengeTitle: params.challengeTitle,
          leaderPosition: params.leaderPosition,
          leaderArea: params.leaderArea,
          leaderWhatsapp: params.leaderWhatsapp,
          lastActiveAt: params.lastActiveAt,
          lastActiveFormatted: params.lastActiveFormatted,
          actionPlan: params.actionPlan,
          type: 'stage5_inactivity_admin',
          subject: `🚨 Alerta de Inactividad (Día 8): ${params.leaderName} (${params.companyName || 'Empresa'}) sin avances en Etapa 5`,
          replyTo: params.leaderEmail || 'hola@taniapadierna.com',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        return {
          success: true,
          emailId: data.emailId || data.id,
          realSent: data.realSent ?? true,
          message: data.message || 'Alerta de inactividad Día 8 enviada a Administradora.',
        };
      }
      return {
        success: false,
        error: data.error || data.message || 'Error al enviar alerta Día 8',
      };
    } catch (error) {
      console.error('Error despachando alerta Día 8 a Administradora:', error);
      return {
        success: false,
        error: (error as any)?.message || 'Error de red en alerta Día 8',
      };
    }
  }
}

export const emailService = EmailService.getInstance();
