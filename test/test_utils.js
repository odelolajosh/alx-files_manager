
export const waitFor = async (client, retries = 10) => {
	let i = 0;
	while (!client.isAlive()) {
		if (i === retries) throw new Error('Could not connect to redis');
		console.log('Waiting for redis...');
		await new Promise((resolve) => setTimeout(resolve, 30));
		i++;
	}
}
