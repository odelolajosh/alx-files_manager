import * as redis from 'redis';
import { promisify } from 'util';

/**
 * Redis client
 * @class RedisClient
 */
export class RedisClient {
  /**
   * Create a redis client
   * @constructor
   */
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => {
      console.log('Redis error: ', String(err));
    });
    this._set = promisify(this.client.set).bind(this.client);
    this._get = promisify(this.client.get).bind(this.client);
    this._del = promisify(this.client.del).bind(this.client);
  }

  /**
   * Check if the client is connected to the database
   * @returns {boolean}
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Get a value from the database
   * @return {Promise<string>}
   * @async
   */
  async get(key) {
    return this._get(key);
  }

  /**
   * Set a value in the database
   * @param {string} key - Key to store
   * @param {string} value - Value to store
   * @param {number} duration - Duration in seconds
   * @async
   */
  async set(key, value, duration) {
    await this._set(key, value, 'EX', duration);
  }

  /**
   * Delete a value from the database
   * @param {string} key
   * @async
   */
  async del(key) {
    await this._del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
