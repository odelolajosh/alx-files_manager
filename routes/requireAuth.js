import redisClient from '../utils/redis';
import { ObjectId } from 'mongodb';

const requireAuth = async (req, res, next) => {
  const token = req.get('X-Token');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.token = token;
  req.userId = new ObjectId(userId);
  return next();
};

export default requireAuth;
