import chai from 'chai';
import chaiHttp from 'chai-http';

import { v4 as uuidv4 } from 'uuid';

import { MongoClient, ObjectId } from 'mongodb';
import { promisify } from 'util';
import redis from 'redis';
import sha1 from 'sha1';

chai.use(chaiHttp);

describe('GET /files', () => {
	let testClientDb;
	let testRedisClient;
	let redisDelAsync;
	let redisGetAsync;
	let redisSetAsync;
	let redisKeysAsync;

	let initialUser = null;
	let initialUserId = null;
	let initialUserToken = null;

	let initialFiles = [];

	const fctRandomString = () => {
		return Math.random().toString(36).substring(2, 15);
	}
	const fctRemoveAllRedisKeys = async () => {
		const keys = await redisKeysAsync('auth_*');
		keys.forEach(async (key) => {
			await redisDelAsync(key);
		});
	}

	beforeEach(async () => {
		const dbInfo = {
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT || '27017',
			database: process.env.DB_DATABASE || 'files_manager'
		};

		const client = await MongoClient.connect(`mongodb://${dbInfo.host}:${dbInfo.port}/${dbInfo.database}`);
		
		testClientDb = client.db(dbInfo.database);

		await testClientDb.collection('users').deleteMany({})
		await testClientDb.collection('files').deleteMany({})

		// Add 1 user
		initialUser = {
			email: `${fctRandomString()}@me.com`,
			password: sha1(fctRandomString())
		}
		const inserted = await testClientDb.collection('users').insertOne(initialUser);
		initialUserId = inserted.insertedId.toString();

		// Add folders
		for (let i = 0; i < 25; i += 1) {
			const item = {
				userId: new ObjectId(initialUserId),
				name: fctRandomString(),
				type: "folder",
				parentId: '0'
			};
			const createdFile = await testClientDb.collection('files').insertOne(item);
			item.id = createdFile.insertedId.toString();
			initialFiles.push(item)
		}

		testRedisClient = redis.createClient();

		var retries = 5;
		while (retries && !testRedisClient.connected) {
			await new Promise((resolve) => setTimeout(resolve, 300));
			retries -= 1;
		}

		redisDelAsync = promisify(testRedisClient.del).bind(testRedisClient);
		redisGetAsync = promisify(testRedisClient.get).bind(testRedisClient);
		redisSetAsync = promisify(testRedisClient.set).bind(testRedisClient);
		redisKeysAsync = promisify(testRedisClient.keys).bind(testRedisClient);

		fctRemoveAllRedisKeys();

		// Set token for this user
		initialUserToken = uuidv4()
		await redisSetAsync(`auth_${initialUserToken}`, initialUserId.toString())
	});

	afterEach(() => {
		fctRemoveAllRedisKeys();
	});

	it('GET /files with no parentId and no page', (done) => {
		chai.request('http://localhost:5000')
			.get(`/files`)
			.set('X-Token', initialUserToken)
			.end((err, res) => {
				chai.expect(err).to.be.null;
				chai.expect(res).to.have.status(200);

				const resList = res.body;
				chai.expect(resList.length).to.equal(20);

				resList.forEach((item) => {
					const itemIdx = initialFiles.findIndex((i) => i.id == item.id);
					chai.assert.isAtLeast(itemIdx, 0);

					const itemInit = initialFiles.splice(itemIdx, 1)[0];
					chai.expect(itemInit).to.not.be.null;

					chai.expect(itemInit.id).to.equal(item.id);
					chai.expect(itemInit.name).to.equal(item.name);
					chai.expect(itemInit.type).to.equal(item.type);
					chai.expect(itemInit.parentId).to.equal(item.parentId);
				});

				chai.expect(initialFiles.length).to.equal(5);

				done();
			});
	}).timeout(30000);
});
