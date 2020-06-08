import { expect } from 'chai';

import App from '../src/compose/app';
import { DatabaseApp } from '../src/target-state';
/*

export interface DatabaseApp {
	id: number;
	name: string;
	releaseId: number;
	commit: string;
	appId: number;
	services: string;
	networks: string;
	source: string;
}
*/
const dbApps: DatabaseApp[] = [
	{
		id: 1,
		name: 'testapp',
		releaseId: 10,
		commit: 'abcdef',
		appId: 11,
		services: JSON.stringify([]),
		networks: JSON.stringify([]),
		source: 'test-files',
	},
];

describe.only('Apps', () => {
	describe('Database format', () => {
		it('should initialize an App from the database format', () => {
			const app = App.newFromDb(dbApps[0]);
			expect(app.appId).to.equal(dbApps[0].appId);
			expect(app.appName).to.equal(dbApps[0].name);
			expect(app.releaseId).to.equal(dbApps[0].releaseId);
			expect(app.commit).to.equal(dbApps[0].commit);
			expect(app.source).to.equal(dbApps[0].source);
		});
	});
});
