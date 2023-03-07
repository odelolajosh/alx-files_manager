import { expect } from 'chai';
import request from 'supertest';
import app from '../../server';
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';

describe('App Stats', () => {
	describe('GET /status', () => {
		it('should have the required body properties', async () => {
			const response = await request(app).get('/status')
			expect(response.body).to.have.property('redis', redisClient.isAlive());
			expect(response.body).to.have.property('db', dbClient.isAlive());
		});

		it('should have the required status code', async () => {
			const response = await request(app).get('/status')
			expect(response.status).to.equal(200);
		});
	});

	describe('GET /stats', () => {
		it('should have the required body properties', async () => {
			const response = await request(app).get('/stats')
			expect(response.body).to.have.property('files');
			expect(response.body).to.have.property('users');
		});

		it('should have the required status code', async () => {
			const response = await request(app).get('/stats')
			expect(response.status).to.equal(200);
		});
	});
});
