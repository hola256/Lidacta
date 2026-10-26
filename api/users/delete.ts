import usersHandler from '../users';

export default async function handler(req: any, res: any) {
  return usersHandler(req, res);
}
