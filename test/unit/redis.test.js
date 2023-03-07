import { expect } from "chai";
import { RedisClient } from "../../utils/redis";
import { waitFor } from "../test_utils";

describe('Redis Client', () => {
	it('should create a redis client', async () => {
		const client = new RedisClient();
		await waitFor(client);
		expect(client.isAlive()).to.be.true;
		expect(client).to.have.property('client');
	});
});
