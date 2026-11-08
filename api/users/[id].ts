import usersHandler from '../users.ts';

export const maxDuration = 60; // 60 segundos de timeout

export default async function handler(req: any, res: any) {
  return usersHandler(req, res);
}

