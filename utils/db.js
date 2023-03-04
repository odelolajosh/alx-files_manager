import { MongoClient } from 'mongodb';

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
		return await this.userCollection.countDocuments();
	}

	/**
	 * Get the number of files in the database
	 * @returns {Promise<number>}
	 */
	async nbFiles() {
		return await this.fileCollection.countDocuments();
	}
}

const dbClient = new DBClient();
export default dbClient;
