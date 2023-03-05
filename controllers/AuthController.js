import sha1 from 'sha1';
import { v4 as uuidV4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    const [type, credentials] = req.headers.authorization.split(' ');

    if (type !== 'Basic') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [email, password] = Buffer.from(credentials, 'base64').toString().split(':');
    const user = await dbClient.userCollection.findOne({ email });
    if (!user || user.password !== sha1(password)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidV4();
    redisClient.set(`auth_${token}`, user._id.toString(), 24 * 60 * 60);

    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204);
  }
}
