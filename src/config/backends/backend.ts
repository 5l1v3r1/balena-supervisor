import * as _ from 'lodash';
import { child_process } from 'mz';

import * as constants from '../../lib/constants';
import { writeFileAtomic } from '../../lib/fs-utils';

export interface ConfigOptions {
	[key: string]: string | string[];
}

export const bootMountPoint = `${constants.rootMountPoint}${constants.bootMountPoint}`;

export async function remountAndWriteAtomic(
	file: string,
	data: string,
): Promise<void> {
	// Here's the dangerous part:
	await child_process.exec(
		`mount -t vfat -o remount,rw ${constants.bootBlockDevice} ${bootMountPoint}`,
	);
	await writeFileAtomic(file, data);
}

export abstract class DeviceConfigBackend {
	// Does this config backend support the given device type?
	public abstract matches(deviceType: string): boolean;

	// A function which reads and parses the configuration options from
	// specific boot config
	public abstract getBootConfig(): Promise<ConfigOptions>;

	// A function to take a set of options and flush to the configuration
	// file/backend
	public abstract setBootConfig(opts: ConfigOptions): Promise<void>;

	// Is the configuration option provided supported by this configuration
	// backend
	public abstract isSupportedConfig(configName: string): boolean;

	// Is this variable a boot config variable for this backend?
	public abstract isBootConfigVar(envVar: string): boolean;

	// Convert a configuration environment variable to a config backend
	// variable
	public abstract processConfigVarName(envVar: string): string;

	// Process the value if the environment variable, ready to be written to
	// the backend
	public abstract processConfigVarValue(
		key: string,
		value: string,
	): string | string[];

	// Return the env var name for this config option
	public abstract createConfigVarName(configName: string): string;

	// Allow a chosen config backend to be initialised
	public async initialise(): Promise<DeviceConfigBackend> {
		return this;
	}
}
