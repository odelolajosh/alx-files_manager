import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const ACCEPTED_TYPES = ['folder', 'file', 'image'];
const FOLDER_LOCATION = process.env.FOLDER_PATH || '/tmp/files_manager';

export default class FilesController {
  /** POST /files */
  static async postUpload(req, res) {
    const userId = req.userId;
    const document = await FilesController._getFileProperties(req);
    if (document.error) return res.status(400).json({ error: document.error });
    document.userId = userId;
    if (document.type !== 'folder') {
      const { localPath, error } = await FilesController._saveFile(document);
      if (error) return res.status(400).json({ error });
      document.localPath = localPath;
    }
    delete document.data;
    const file = await dbClient.fileCollection.insertOne(document);
    delete document.localPath;
    delete document._id;
    return res.status(201).json({ id: file.insertedId, ...document });
  }

  /** GET /files:id */
  static async getShow(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const file = await dbClient.findUserFileById(userId, id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    file.id = file._id;
    delete file._id;
    delete file.localPath;
    return res.status(200).json(file);
  }

  /** GET /files */
  static async getIndex(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { parentId = 0, page = 0 } = req.query;
    const { files = [] } = await dbClient.findUserFiles(userId, parentId, { page });
    return res.status(200).json(files);
  }

  /** PUT /files/:id/publish */
  static async putPublish(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const file = await dbClient.findUserFileById(userId, id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (!file.isPublic) {
      await dbClient.updateFileById(file._id, { $set: { isPublic: true } });
      file.isPublic = true;
    }
    file.id = file._id;
    delete file._id;
    delete file.localPath;
    return res.status(200).json(file);
  }

  /** PUT /files/:id/unpublish */
  static async putUnpublish(req, res) {
    const token = req.get('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const file = await dbClient.findUserFileById(userId, id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.isPublic) {
      await dbClient.updateFileById(file._id, { $set: { isPublic: false } });
      file.isPublic = false;
    }
    file.id = file._id;
    delete file._id;
    delete file.localPath;
    return res.status(200).json(file);
  }

  static async _getFileProperties(req) {
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    if (!name) return { error: 'Missing name' };
    if (!type || !(ACCEPTED_TYPES.includes(type))) return { error: 'Missing type' };
    if (type !== 'folder' && !data) return { error: 'Missing data' };
    if (parentId !== 0) {
      const parent = await dbClient.findFileById(parentId);
      if (!parent) return { error: 'Parent not found' };
      if (parent.type !== 'folder') return { error: 'Parent is not a folder' };
    }
    return {
      name, type, parentId, isPublic, data,
    };
  }

  static async _saveFile(document) {
    try {
      await fs.mkdir(FOLDER_LOCATION, { recursive: true });
      const localPath = `${FOLDER_LOCATION}/${uuidv4()}`;
      await fs.writeFile(localPath, document.data, 'base64');
      return { localPath };
    } catch (error) {
      return { error: 'Error while saving file' };
    }
  }
}
