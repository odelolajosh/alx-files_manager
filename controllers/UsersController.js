import sha1 from 'sha1';
import dbClient from '../utils/db';

export default class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    if (await dbClient.userCollection.findOne({ email })) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await dbClient.userCollection.insertOne({
      email: String(email).trim(),
      password: sha1(password),
    });

    return res.status(201).json({ id: user.insertedId, email });
  }
}
