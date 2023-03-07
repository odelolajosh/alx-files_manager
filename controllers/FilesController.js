import { promises as fs, existsSync as fsExistsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import dbClient, { ObjectId } from '../utils/db';
import { fileQueue } from '../worker';

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
      const { localPath, error } = await FilesController._saveDocument(document);
      if (error) return res.status(400).json({ error });
      document.localPath = localPath;
    }
    delete document.data;
    const file = await dbClient.fileCollection.insertOne(document);
    if (document.type === 'image') {
      fileQueue.add({ fileId: file.insertedId, userId });
    }
    delete document.localPath;
    delete document._id;
    return res.status(201).json({ id: file.insertedId, ...document });
  }

  /** GET /files:id */
  static async getShow(req, res) {
    const { params: { id }, userId } = req;
    try {
      const file = await dbClient.findUserFileById(userId, id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(FilesController._sanitizeFile(file));
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  /** GET /files */
  static async getIndex(req, res) {
    const { userId } = req;
    const { parentId = 0, page = 0 } = req.query;
    try {
      const { files = [] } = await dbClient.findUserFiles(userId, parentId, { page });
      return res.status(200).json(files);
    } catch (err) {
      return res.status(200).json([]);
    }
  }

  /** PUT /files/:id/publish */
  static async putPublish(req, res) {
    const { params: { id }, userId } = req;
    try {
      const file = await dbClient.findUserFileById(userId, id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      if (!file.isPublic) {
        await dbClient.updateFileById(file._id, { $set: { isPublic: true } });
        file.isPublic = true;
      }
      return res.status(200).json(FilesController._sanitizeFile(file));
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  /** PUT /files/:id/unpublish */
  static async putUnpublish(req, res) {
    const { params: { id }, userId } = req;
    try {
      const file = await dbClient.findUserFileById(userId, id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      if (file.isPublic) {
        await dbClient.updateFileById(file._id, { $set: { isPublic: false } });
        file.isPublic = false;
      }
      return res.status(200).json(FilesController._sanitizeFile(file));
    } catch (err) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  /** GET /files/:id/data */
  static async getFile(req, res) {
    const { params: { id }, query: { size }, userId } = req;
    const file = await dbClient.findFileById(id);
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!file.isPublic && String(file.userId) !== String(userId)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }
    const path = size ? `${file.localPath}_${size}` : file.localPath;
    if (!fsExistsSync(path)) {
      return res.status(404).json({ error: 'Not found' });
    }
    try {
      const data = await fs.readFile(path);
      const mimeType = mime.contentType(file.name) || 'text/plain';
      res.setHeader('Content-Length', data.length);
      res.setHeader('Content-Type', mimeType);
      return res.status(200).send(data);
    } catch (error) {
      return res.status(404).json({ error: 'Error while reading file' });
    }
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

  static async _saveDocument(document) {
    try {
      await fs.mkdir(FOLDER_LOCATION, { recursive: true });
      const localPath = `${FOLDER_LOCATION}/${uuidv4()}`;
      await fs.writeFile(localPath, document.data, 'base64');
      return { localPath };
    } catch (error) {
      return { error: 'Error while saving file' };
    }
  }

  static async _saveThumbnail(thumbnail, file, size) {
    try {
      await fs.mkdir(FOLDER_LOCATION, { recursive: true });
      const path = `${file.localPath}_${size}`;
      await fs.writeFile(path, thumbnail);
      return { path };
    } catch (error) {
      return { error: 'Error while saving thumbnail' };
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
