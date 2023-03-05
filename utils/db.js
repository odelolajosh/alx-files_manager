import { MongoClient, ObjectId } from 'mongodb';

/**
 * Database client
 * @class
 */
class DBClient {
  /**
   * Create a database client
   * @constructor
   */
  constructor() {
    this.HOST = process.env.DB_HOST || 'localhost';
    this.PORT = process.env.DB_PORT || 27017;
    this.DATABASE = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${this.HOST}:${this.PORT}`;
    this.client = new MongoClient(url, { useNewUrlParser: true });
    this.db = null;

    this.client.connect().then(() => {
      this.db = this.client.db(this.DATABASE);
      this.userCollection = this.db.collection('users');
      this.fileCollection = this.db.collection('files');
    });
  }

  /**
   * Check if the client is connected to the database
   * @returns {boolean}
   */
  isAlive() {
    return !!this.db;
  }

  /**
   * Get the number of users in the database
   * @returns {Promise<number>}
   * @async
   */
  async nbUsers() {
    return this.userCollection.countDocuments();
  }

  /**
   * Get the number of files in the database
   * @returns {Promise<number>}
   */
  async nbFiles() {
    return this.fileCollection.countDocuments();
  }

  /**
   * Find a user by its id
   * @param {string} _id - User id
   * @returns {Promise<Object>}
   * @async
   */
  async findUserById(id) {
    let _id = id;
    if (!(_id instanceof ObjectId)) {
      _id = new ObjectId(_id);
    }
    return this.userCollection.findOne({ _id });
  }

  /**
   * Find a file by its id
   * @param {string} _id - File id
   * @returns {Promise<Object>}
   * @async
   */
  async findFileById(id) {
    let _id = id;
    if (!(_id instanceof ObjectId)) {
      _id = new ObjectId(_id);
    }
    return this.fileCollection.findOne({ _id });
  }

  /**
   * Insert a new file in the database
   * @param {Object} user - User object
   * @returns {Promise<Object>}
   * @async
   */
  async insertFile(file) {
    return this.fileCollection.insertOne(file);
  }

  /**
   * Find a file by user id and file id
   * @param {string} userId - User id
   * @param {string} fileId - File id
   * @returns {Promise<Object>}
   * @async
   */
  async findUserFileById(userId, fileId) {
    let _id = fileId;
    if (!(_id instanceof ObjectId)) {
      _id = new ObjectId(_id);
    }
    return this.fileCollection.findOne({ userId, _id });
  }

  /**
   * Find a file by user id and file id
   * @param {string} userId - User id
   * @param {string} parentId - folder id
   * @param {Object} options - File id
   * @async
   */
  async findUserFiles(userId, parentId = 0, options = {}) {
    const { page = 0, limit = 20 } = options;
    const pipeline = [
      { $match: { parentId, userId } },
      { $sort: { createdAt: -1 } },
      { $skip: page * limit },
      { $limit: limit },
      { $addFields: { id: '$_id' } },
      { $project: { _id: 0, localPath: 0 } },
    ];
    const files = await this.fileCollection.aggregate(pipeline).toArray();
    const total = await this.fileCollection.countDocuments({ parentId });
    return { files, total };
  }
}

const dbClient = new DBClient();
export default dbClient;
