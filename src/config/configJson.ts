import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import { fs } from 'mz';
import * as path from 'path';

import * as constants from '../lib/constants';
import { writeAndSyncFile, writeFileAtomic } from '../lib/fs-utils';
import * as osRelease from '../lib/os-release';

import log from '../lib/supervisor-console';

import { readLock, writeLock } from '../lib/update-lock';
import * as Schema from './schema';

export default class ConfigJsonConfigBackend {
	private readonly readLockConfigJson: () => Bluebird.Disposer<() => void>;
	private readonly writeLockConfigJson: () => Bluebird.Disposer<() => void>;

	private readonly schema: Schema.Schema;
	private readonly configPath?: string;

	private cache: { [key: string]: unknown } = {};

	private readonly init = _.once(async () =>
		_.assign(this.cache, await this.read()),
	);

	public constructor(schema: Schema.Schema, configPath?: string) {
		this.configPath = configPath;
		this.schema = schema;

		this.writeLockConfigJson = () =>
			writeLock('config.json').disposer(release => release());
		this.readLockConfigJson = () =>
			readLock('config.json').disposer(release => release());
	}

	public async set<T extends Schema.SchemaKey>(
		keyVals: { [key in T]: unknown },
	) {
		await this.init();
		await Bluebird.using(this.writeLockConfigJson(), async () => {
			let changed = false;
			_.forOwn(keyVals, (value, key: T) => {
				if (this.cache[key] !== value) {
					this.cache[key] = value;

					if (
						value == null &&
						this.schema[key] != null &&
						this.schema[key].removeIfNull
					) {
						delete this.cache[key];
					}

					changed = true;
				}
			});
			if (changed) {
				await this.write();
			}
		});
	}

	public async get(key: string): Promise<unknown> {
		await this.init();
		return Bluebird.using(
			this.readLockConfigJson(),
			async () => this.cache[key],
		);
	}

	public async remove(key: string) {
		await this.init();
		return Bluebird.using(this.writeLockConfigJson(), async () => {
			let changed = false;

			if (this.cache[key] != null) {
				delete this.cache[key];
				changed = true;
			}

			if (changed) {
				await this.write();
			}
		});
	}

	public async path(): Promise<string> {
		await this.init();
		try {
			return await this.pathOnHost();
		} catch (err) {
			log.error('There was an error detecting the config.json path', err);
			return constants.configJsonNonAtomicPath;
		}
	}

	private write(): Promise<void> {
		let atomicWritePossible = true;
		return this.pathOnHost()
			.catch(err => {
				log.error('There was an error detecting the config.json path', err);
				atomicWritePossible = false;
				return constants.configJsonNonAtomicPath;
			})
			.then(configPath => {
				if (atomicWritePossible) {
					return writeFileAtomic(configPath, JSON.stringify(this.cache));
				} else {
					return writeAndSyncFile(configPath, JSON.stringify(this.cache));
				}
			});
	}

	private async read(): Promise<string> {
		const filename = await this.path();
		return JSON.parse(await fs.readFile(filename, 'utf-8'));
	}

	private async resolveConfigPath(): Promise<string> {
		if (this.configPath != null) {
			return this.configPath;
		}
		if (constants.configJsonPathOnHost != null) {
			return constants.configJsonPathOnHost;
		}

		const osVersion = await osRelease.getOSVersion(constants.hostOSVersionPath);
		if (osVersion == null) {
			throw new Error('Failed to detect OS version!');
		}

		if (/^(Resin OS|balenaOS)/.test(osVersion)) {
			// In Resin OS 1.12, $BOOT_MOUNTPOINT was added and it coincides with config.json's path.
			if (constants.bootMountPointFromEnv != null) {
				return path.join(constants.bootMountPointFromEnv, 'config.json');
			}
			// Older 1.X versions have config.json here
			return '/mnt/conf/config.json';
		} else {
			// In non-resinOS hosts (or older than 1.0.0), if CONFIG_JSON_PATH wasn't passed
			// then we can't do atomic changes (only access to config.json we have is in /boot,
			// which is assumed to be a file bind mount where rename is impossible).
			throw new Error(
				'Could not determine config.json path on host, atomic write will not be possible',
			);
		}
	}

	private async pathOnHost(): Promise<string> {
		return path.join(constants.rootMountPoint, await this.resolveConfigPath());
	}
}
