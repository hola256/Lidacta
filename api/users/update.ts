import usersHandler from '../users.ts';

export default async function handler(req: any, res: any) {
  return usersHandler(req, res);
}

