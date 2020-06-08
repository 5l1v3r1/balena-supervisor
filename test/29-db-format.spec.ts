import prepare = require('./lib/prepare');

import * as db from '../src/db';
import * as dbFormat from '../src/device-state/db-format';

describe('DB Format', () => {
	before(async () => {
		await prepare();
		await db.models('app').insert({
			appId: 1,
			commit: 'abcdef',
			name: 'test-app',
			source: 'tests',
			releaseId: 123,
			services: '[]',
			networks: '{}',
			volumes: {},
		});
	});

	after(async () => {
		await prepare();
	});

	it('should retrieve a single app from the database', async () => {
		const app = await dbFormat.getApp(1);
	});
});
