import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

const THUMBNAIL_SIZES = [500, 250, 100];

export const fileQueue = new Queue('fileQueue');
export const userQueue = new Queue('userQueue');

fileQueue.on('completed', (job) => {
  console.log(`File Job ${job.id} completed`);
});

fileQueue.on('failed', (job, err) => {
  console.log(`File Job ${job.id} failed: ${err.message}`);
});

userQueue.on('completed', (job) => {
  console.log(`User Job ${job.id} completed`);
});

userQueue.on('failed', (job, err) => {
  console.log(`User Job ${job.id} failed: ${err.message}`);
});

fileQueue.process(async (job) => {
  // eslint-disable-next-line global-require
  const FilesController = require('./controllers/FilesController').default;
  const { data } = job;
  if (!data.fileId) throw new Error('Missing fileId');
  if (!data.userId) throw new Error('Missing userId');
  const file = await dbClient.findUserFileById(data.userId, data.fileId);
  if (!file) throw new Error('File not found');
  THUMBNAIL_SIZES.forEach(async (size) => {
    try {
      const options = { width: size };
      const thumbnail = await imageThumbnail(file.localPath, options);
      await FilesController._saveThumbnail(thumbnail, file, size);
      return Promise.resolve();
    } catch (err) {
      return Promise.reject(err);
    }
  });
});

userQueue.process(async (job) => {
  const { data } = job;
  if (!data.userId) throw new Error('Missing userId');
  const user = await dbClient.findUserById(data.userId);
  if (!user) throw new Error('User not found');
  console.log(`Welcome ${user.email}`);
  return Promise.resolve();
});
