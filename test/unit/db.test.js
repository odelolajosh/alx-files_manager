import { expect } from "chai";
import { DBClient } from "../../utils/db";
import { waitFor } from "../test_utils";

describe('Db Client', () => {
	it('should create a db client', async () => {
		const client = new DBClient();
		await waitFor(client);
		expect(client.isAlive()).to.be.true;
		expect(client).to.have.property('client');
	});
});
