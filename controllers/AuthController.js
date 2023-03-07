import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  /** Connect a user */
  static async getConnect(req, res) {
    const authorization = req.get('Authorization');
    if (!authorization) return res.status(401).json({ error: 'Unauthorized' });
    const [type, credentials] = authorization.split(' ');
    if (type !== 'Basic' || !credentials) return res.status(401).json({ error: 'Unauthorized' });
    const [email, password] = Buffer.from(credentials, 'base64').toString().split(':');
    const user = await dbClient.userCollection.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (user.password !== sha1(password)) return res.status(401).json({ error: 'Unauthorized' });
    const token = uuidv4();
    redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);
    return res.status(200).json({ token });
  }

  /** Disconnect a user */
  static async getDisconnect(req, res) {
    await redisClient.del(`auth_${req.token}`);
    return res.status(204).end();
  }
}
