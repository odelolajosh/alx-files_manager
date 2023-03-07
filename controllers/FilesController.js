import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dbClient, { ObjectId } from '../utils/db';

const ACCEPTED_TYPES = ['folder', 'file', 'image'];
const FOLDER_LOCATION = process.env.FOLDER_PATH || '/tmp/files_manager';

export default class FilesController {
  /** POST /files */
  static async postUpload(req, res) {
    const { userId } = req;
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
    const { params: { id }, userId } = req;
    const file = await dbClient.findUserFileById(userId, id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json(FilesController._sanitizeFile(file));
  }

  /** GET /files */
  static async getIndex(req, res) {
    const { userId } = req;
    const { parentId = 0, page = 0 } = req.query;
    const { files = [] } = await dbClient.findUserFiles(userId, parentId, { page });
    return res.status(200).json(files);
  }

  /** PUT /files/:id/publish */
  static async putPublish(req, res) {
    const { params: { id }, userId } = req;
    const file = await dbClient.findUserFileById(userId, id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (!file.isPublic) {
      await dbClient.updateFileById(file._id, { $set: { isPublic: true } });
      file.isPublic = true;
    }
    return res.status(200).json(FilesController._sanitizeFile(file));
  }

  /** PUT /files/:id/unpublish */
  static async putUnpublish(req, res) {
    const { params: { id }, userId } = req;
    const file = await dbClient.findUserFileById(userId, id);
    if (!file) return res.status(404).json({ error: 'Not found' });
    if (file.isPublic) {
      await dbClient.updateFileById(file._id, { $set: { isPublic: false } });
      file.isPublic = false;
    }
    return res.status(200).json(FilesController._sanitizeFile(file));
  }

  static async _getFileProperties(req) {
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    if (!name) return { error: 'Missing name' };
    if (!type || !(ACCEPTED_TYPES.includes(type))) return { error: 'Missing type' };
    if (type !== 'folder' && !data) return { error: 'Missing data' };
    const file = {
      name, type, parentId, isPublic, data,
    };
    if (parentId !== 0) {
      const parent = await dbClient.findFileById(parentId);
      if (!parent) return { error: 'Parent not found' };
      if (parent.type !== 'folder') return { error: 'Parent is not a folder' };
      file.parentId = new ObjectId(parentId);
    }
    return file;
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

  /** remove sensitive properties from file object */
  static _sanitizeFile(file) {
    const clone = { ...file };
    clone.id = clone._id;
    delete clone.localPath;
    delete clone._id;
    return clone;
  }
}
