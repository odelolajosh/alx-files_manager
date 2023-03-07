import { expect } from "chai";
import redis from "redis";
import sinon from "sinon";
import { RedisClient } from "../../utils/redis";
import { waitFor } from "../test_utils";

describe('Redis Client', () => {
	const RedisSpy = sinon.spy(redis);

	afterEach(() => {
		RedisSpy.createClient.resetHistory();
	});

	it('should create a redis client', async () => {
		const client = new RedisClient();
		await waitFor(client);
		console.log(client.isAlive());
		expect(client.isAlive()).to.be.true;
		console.log(RedisSpy.createClient.callCount)
		expect(client).to.have.property('client');
		// expect(RedisSpy.createClient.calledOnce).to.be.true;
	});
});
