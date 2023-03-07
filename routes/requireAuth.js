import redisClient from "../utils/redis";

const requireAuth = async (req, res, next) => {
	const token = req.get('X-Token');
	if (!token) return res.status(401).json({ error: 'Unauthorized' });
	const userId = await redisClient.get(`auth_${token}`);
	if (!userId) return res.status(401).json({ error: 'Unauthorized' });
	req.userId = userId;
	next();
}

export default requireAuth;