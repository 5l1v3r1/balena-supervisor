import * as _ from 'lodash';

import { docker } from '../lib/docker-utils';

import Network from './network';
import Volume from './volume';
import Service from './service';

export interface AppConstructOpts {
	appId: number;
	appName: string;
	commit: string;
	releaseId: number;
	source: string;

	// TODO: These are how the values are stored in the
	// database, but we should have them consistent
	services: Service[];
	volumes: Dictionary<Volume>;
	networks: Dictionary<Network>;
}

export class App {
	public appId: number;
	public appName: string;
	public commit: string;
	public releaseId: number;
	public source: string;

	public services: Service[];
	public networks: Network[];
	public volumse: Volume[];

	public constructor(opts: AppConstructOpts) {
		this.appId = opts.appId;
		this.appName = opts.appName;
		this.commit = opts.commit;
		this.releaseId = opts.releaseId;
		this.source = opts.source;
	}

	// // TODO: Images is a singleton, and we shouldn't have to
	// // pass it around like this
	// public static newFromDb(images: Images, app: DatabaseApp): App {
	// 	return new App({
	// 		appId: app.appId,
	// 		appName: app.name,
	// 		commit: app.commit,
	// 		releaseId: app.releaseId,
	// 		source: app.source,

	// 		services:
	// 	});

	// }
}

export default App;
