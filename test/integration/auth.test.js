import { expect } from 'chai';
import { describe } from 'mocha';
import request from 'supertest';
import app from '../../server';
import dbClient from '../../utils/db';
import { waitFor } from '../test_utils';

describe('Authentication', () => {
	let token, user;
	let credentials = {
		email: 'bob@dylan.com',
		password: 'toto1234!'
	};
	
	before(async () => {
		// let's make sure the database is empty
		await waitFor(dbClient);
		const collections = await dbClient.db.listCollections().toArray();
		for (const collection of collections) {
			await dbClient.db.dropCollection(collection.name);
		}
	});

	describe('POST /users', () => {
		it('should create a new user', async () => {
			const response = await request(app).post('/users').send(credentials)
			expect(response.status).to.equal(201);
			expect(response.body).to.have.property('id');
			expect(response.body).to.have.property('email', credentials.email);
			user = response.body;
		});

		it('should not create a new user with the same email', async () => {
			const response = await request(app).post('/users').send(credentials)
			expect(response.status).to.equal(400);
			expect(response.body).to.have.property('error', 'Already exist');
		});

		it('should not create a new user without email', async () => {
			const response = await request(app).post('/users').send({ password: credentials.password })
			expect(response.status).to.equal(400);
			expect(response.body).to.have.property('error', 'Missing email');
		});

		it('should not create a new user without password', async () => {
			const response = await request(app).post('/users').send({ email: credentials.email })
			expect(response.status).to.equal(400);
			expect(response.body).to.have.property('error', 'Missing password');
		});

		it('should not save the password in clear', async () => {
			const userInDb = await dbClient.userCollection.findOne({ email: credentials.email });
			expect(userInDb).to.have.property('password');
			expect(userInDb.password).not.to.equal(credentials.password);
		});
	});

	describe('GET /connect', () => {
		const authorization = `Basic ${Buffer.from(`${credentials.email}:${credentials.password}`).toString('base64')}`;

		it('should generate a new authentication token', async () => {
			const response = await request(app).get('/connect').set('Authorization', authorization)
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('token');
			token = response.body.token;
		});

		it('should not generate a same authentication token', async () => {
			const response = await request(app).get('/connect').set('Authorization', authorization)
			expect(response.status).to.equal(200);
			expect(response.body.token).not.to.equal(token);
		});

		it('should not generate a new authentication token without authorization header', async () => {
			const response = await request(app).get('/connect')
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});

		it('should not generate a new authentication token with invalid authorization header', async () => {
			const authorization = `Advanced ${Buffer.from(`${credentials.email}:${credentials.password}`).toString('base64')}`;
			const response = await request(app).get('/connect').set('Authorization', authorization)
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});

		it('should not generate a new authentication token with invalid email', async () => {
			const authorization = `Basic ${Buffer.from(`toto:${credentials.password}`).toString('base64')}`;
			const response = await request(app).get('/connect').set('Authorization', authorization)
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});

		it('should not generate a new authentication token with invalid password', async () => {
			const authorization = `Basic ${Buffer.from(`${credentials.email}:toto`).toString('base64')}`;
			const response = await request(app).get('/connect').set('Authorization', authorization)
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});
	});

	describe('GET /users/me', () => {
		it('should return the user', async () => {
			const response = await request(app).get('/users/me').set('X-Token', token)
			expect(response.status).to.equal(200);
			expect(response.body).to.have.property('id', user.id);
			expect(response.body).to.have.property('email', credentials.email);
			user = response.body;
		});

		it('should not return the user without token', async () => {
			const response = await request(app).get('/users/me')
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});
	});

	describe('GET /disconnect', () => {
		it('should delete the token', async () => {
			const response = await request(app).get('/disconnect').set('X-Token', token)
			expect(response.status).to.equal(204);
		});

		it('should not return the user', async () => {
			const response = await request(app).get('/users/me').set('X-Token', token)
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});

		it('should not delete an already deleted token', async () => {
			const response = await request(app).get('/disconnect').set('X-Token', token)
			expect(response.status).to.equal(401);
			expect(response.body).to.have.property('error', 'Unauthorized');
		});
	});
});