import sha1 from 'sha1';
import dbClient from '../utils/db';
import { userQueue } from '../worker';

export default class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    if (await dbClient.userCollection.findOne({ email })) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const user = await dbClient.userCollection.insertOne({
      email,
      password: sha1(password),
    });

    userQueue.add({ userId: user.insertedId });
    return res.status(201).json({ id: user.insertedId, email });
  }

  static async getMe(req, res) {
    const user = await dbClient.findUserById(req.userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    return res.status(200).json({ id: user._id, email: user.email });
  }
}
