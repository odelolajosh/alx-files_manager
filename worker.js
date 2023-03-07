import Queue from 'bull';
import dbClient from './utils/db';
import imageThumbnail from 'image-thumbnail';
import FilesController from './controllers/FilesController';

const THUMBNAIL_SIZES = [500, 250, 100];

export const fileQueue = new Queue('fileQueue');

fileQueue.on('completed', (job) => {
	console.log(`Job ${job.id} completed`);
});

fileQueue.on('failed', (job, err) => {
	console.log(`Job ${job.id} failed: ${err.message}`);
});


fileQueue.process(async (job) => {
	const { data } = job;
	if (!data.fileId) return Promise.reject('Missing fileId');
	if (!data.userId) return Promise.reject('Missing userId');
	const file = await dbClient.findUserFileById(data.userId, data.fileId);
	if (!file) return Promise.reject('File not found');
	THUMBNAIL_SIZES.forEach(async (width) => {
		try {
			const options = { width };
			const thumbnail = await imageThumbnail(file.localPath, options);
			await FilesController._saveThumbnail(thumbnail, file, size);
		} catch (err) {
			return Promise.reject(err);
		}
	});
});
