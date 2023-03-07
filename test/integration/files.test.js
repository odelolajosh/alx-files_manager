import { expect } from 'chai';
import { describe } from 'mocha';
import request from 'supertest';
import fs from 'fs';
import app from '../../server';
import dbClient from '../../utils/db';
import { waitFor } from '../test_utils';

describe('File Manager!', () => {
	let token, user, files = [], files2 = []
	let credentials = {
		email: 'bob@dylan.com',
		password: 'toto1234!'
	};

	const content = 'Hello World!';
	const contentInBase64 = Buffer.from(content).toString('base64');

	const FOLDER_LOCATION = process.env.FOLDER_PATH || '/tmp/files_manager_test';

	before(async () => {
		// let's make sure the database is empty
		await waitFor(dbClient);
		const collections = await dbClient.db.listCollections().toArray();
		for (const collection of collections) {
			await dbClient.db.dropCollection(collection.name);
		}

		// clear the storage folder
		if (fs.existsSync(FOLDER_LOCATION)) {
			fs.rmSync(FOLDER_LOCATION, { recursive: true });
		}

		// create a user
		const response1 = await request(app).post('/users').send(credentials)
		expect(response1.status).to.equal(201);
		expect(response1.body).to.have.property('id');
		expect(response1.body).to.have.property('email', credentials.email);
		user = response1.body;

		// get a token
		const authorization = `Basic ${Buffer.from(`${credentials.email}:${credentials.password}`).toString('base64')}`;
		const response2 = await request(app).get('/connect').set('Authorization', authorization)
		expect(response2.status).to.equal(200);
		expect(response2.body).to.have.property('token');
		token = response2.body.token;
	});

	describe('POST /files', () => {
		const file = {
			name: 'hello.txt',
			type: 'file',
			data: contentInBase64,
			isPublic: false,
			parentId: 0
		};
		let parentId = 0;

		it('should create a new file', async () => {
			const response = await request(app).post('/files').set('X-Token', token).send(file);
			expect(response.status).to.equal(201);
			expect(response.body).to.have.property('id');
			expect(response.body).to.have.property('userId', user.id);
			expect(response.body).to.have.property('name', file.name);
		});

		it('should create a new folder', async () => {
			const response = await request(app).post('/files').set('X-Token', token).send({ ...file, type: 'folder' });
			expect(response.status).to.equal(201);
			expect(response.body).to.have.property('id');
			expect(response.body).to.have.property('userId', user.id);
			expect(response.body).to.have.property('name', file.name);
			expect(response.body).to.have.property('type', 'folder');
			parentId = response.body.id;
		});

		it('should create a new file in the new folder', async () => {
			const response = await request(app).post('/files').set('X-Token', token).send({ ...file, parentId, isPublic: true });
			expect(response.status).to.equal(201);
			expect(response.body).to.have.property('id');
			expect(response.body).to.have.property('userId', user.id);
			expect(response.body).to.have.property('name', file.name);
			expect(response.body).to.have.property('parentId', parentId);
		});

		it('should not create a new file without name', async () => {
			const response = await request(app).post('/files').set('X-Token', token).send({ ...file, name: '' });
			expect(response.status).to.equal(400);
			expect(response.body).to.have.property('error', 'Missing name');
		});

		it('should not create a new file without valid type', async () => {
			const response = await request(app).post('/files').set('X-Token', token).send({ ...file, type: 'video' });
			expect(response.status).to.equal(400);
			expect(response.body).to.have.property('error', 'Missing type');
		});
	});

	describe('GET /files', () => {
		it('should get all files', async () => {
			const response = await request(app).get('/files').set('X-Token', token);
			expect(response.status).to.equal(200);
			expect(response.body).to.be.an('array');
			expect(response.body).to.have.lengthOf(2);
			files = response.body;
		});

		it('should get all files with a specific parent', async () => {
			const response = await request(app).get('/files').set('X-Token', token).query({ parentId: files[1].id });
			expect(response.status).to.equal(200);
			expect(response.body).to.be.an('array');
			expect(response.body).to.have.lengthOf(1);
			files2 = response.body;
		});

		it('should get return an empty list if no files are found', async () => {
			const response = await request(app).get('/files').set('X-Token', token).query({ parentId: 999 });
			expect(response.status).to.equal(200);
			expect(response.body).to.be.an('array');
			expect(response.body).to.have.lengthOf(0);
		});
	});

	describe('GET /files/:id', () => {
		it('should get a file', async () => {
			const response = await request(app).get(`/files/${files[0].id}`).set('X-Token', token);
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('id', files[0].id);
			expect(response.body).to.have.property('userId', user.id);
			expect(response.body).to.have.property('name', files[0].name);
			expect(response.body).to.have.property('type', files[0].type);
			expect(response.body).to.have.property('isPublic', files[0].isPublic);
			expect(response.body).to.have.property('parentId', files[0].parentId);
		});

		it('should not get a file with an invalid id', async () => {
			const response = await request(app).get('/files/123').set('X-Token', token);
			expect(response.status).to.equal(404);
			expect(response.body).to.have.property('error', 'Not found');
		});
	});

	describe('PUT /files/:id/publish', () => {
		it('should publish a file', async () => {
			const response = await request(app).put(`/files/${files[0].id}/publish`).set('X-Token', token);
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('id', files[0].id);
			expect(response.body).to.have.property('userId', user.id);
			expect(response.body).to.have.property('name', files[0].name);
			expect(response.body).to.have.property('type', files[0].type);
			expect(response.body).to.have.property('isPublic', true);
			expect(response.body).to.have.property('parentId', files[0].parentId);
		});

		it('should actually publish the file', async () => {
			const response = await request(app).get(`/files/${files[0].id}`).set('X-Token', token);
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('isPublic', true);
		})

		it('should not publish a file with an invalid id', async () => {
			const response = await request(app).put('/files/123/publish').set('X-Token', token);
			expect(response.status).to.equal(404);
			expect(response.body).to.have.property('error', 'Not found');
		});

		it('shoud not allow just anyone publish', async () => {
			const response = await request(app).put('/files/123/publish');
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});
	});

	describe('PUT /files/:id/unpublish', () => {
		it('should unpublish a file', async () => {
			const response = await request(app).put(`/files/${files[0].id}/unpublish`).set('X-Token', token);
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('id', files[0].id);
			expect(response.body).to.have.property('userId', user.id);
			expect(response.body).to.have.property('name', files[0].name);
			expect(response.body).to.have.property('type', files[0].type);
			expect(response.body).to.have.property('isPublic', false);
			expect(response.body).to.have.property('parentId', files[0].parentId);
		});

		it('should actually unpublish the file', async () => {
			const response = await request(app).get(`/files/${files[0].id}`).set('X-Token', token);
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('isPublic', false);
		})

		it('should not unpublish a file with an invalid id', async () => {
			const response = await request(app).put('/files/123/unpublish').set('X-Token', token);
			expect(response.status).to.equal(404);
			expect(response.body).to.have.property('error', 'Not found');
		});

		it('shoud not allow just anyone unpublish', async () => {
			const response = await request(app).put('/files/123/unpublish');
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});
	});

	describe('GET /files/:id/data', () => {
		it('should return the content of a file', async () => {
			const response = await request(app).get(`/files/${files[0].id}/data`).set('X-Token', token);
			expect(response.headers).have.property('content-type', 'text/plain; charset=utf-8');
			expect(response.text).to.equal(content);
		})

		it('should not return some data for folder', async () => {
			const response = await request(app).get(`/files/${files[1].id}/data`).set('X-Token', token);
			expect(response.body).to.have.property('error', 'A folder doesn\'t have content');
		})

		it('should allow anyone view a public file', async () => {
			const response = await request(app).get(`/files/${files2[0].id}/data`);
			expect(response.headers).have.property('content-type', 'text/plain; charset=utf-8');
			expect(response.text).to.equal(content);
		});
	});
});