import * as _ from "lodash";

import Network from "../compose/network";
import Volume from "../compose/volume";
import * as db from "../db";
import { InstancedAppState } from "../types/state";

type ApplicationDatabaseFormat = Array<{
	appId: number;
	commit: string;
	name: string;
	source: string;
	releaseId: number;
	services: string;
	networks: string;
	volumes: string;
}>;

type InstancedApp = InstancedAppState[0];

// Fetch and instance an app from the db. Throws if the requested
// appId cannot be found
export async function getApp(id: number): Promise<InstancedApp> {
	const rows = await db.models("app").where({ appId: id }).select();

	if (rows.length === 0) {
		throw new Error("TODO");
	} else if (rows.length > 1) {
		// inconsistent error here
		throw new Error("TODO");
	}

	const dbApp = rows[0];

	// FIXME: Wrap in db error as any of these failures are likely due to the
	// database format being a little broken

	const volumes = _.mapValues(JSON.parse(dbApp.volumes) ?? {}, (conf, name) => {
		if (conf == null) {
			conf = {};
		}
		if (conf.labels == null) {
			conf.labels = {};
		}
		return Volume.fromComposeObject(name, dbApp.addId, conf);
	});

	const networks = _.mapValues(JSON.parse(dbApp.networks) ?? {}, (conf, name) => {
		if (conf == null) {
			conf = {};
		}
		return Network.fromComposeObject(name, dbApp.appId, conf);
	});

	// In the db, the services are an array, but here we switch them to an
	// object so that they are consistent

	const services = (JSON.parse(dbApp.services) ?? []).map(svc => {

	});
}
