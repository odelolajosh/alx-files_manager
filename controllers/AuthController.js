import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  /** Connect a user */
  static async getConnect(req, res) {
    const [type, credentials] = req.get('Authorization').split(' ');
    if (type !== 'Basic') return res.status(401).json({ error: 'Unauthorized' });
    const [email, password] = Buffer.from(credentials, 'base64').toString().split(':');
    const user = await dbClient.userCollection.findOne({
      email,
      password: sha1(password),
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const token = uuidv4();
    redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
    return res.status(200).json({ token });
  }

  /** Disconnect a user */
  static async getDisconnect(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}
