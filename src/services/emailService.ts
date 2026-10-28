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

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Lidacta <notificaciones@taniapadierna.com>';
const DEFAULT_REPLY_TO = process.env.RESEND_REPLY_TO || 'hola@taniapadierna.com';

function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return '';
  }
  return process.env.API_BASE_URL || 'http://localhost:3000';
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
}

export const emailService = EmailService.getInstance();
