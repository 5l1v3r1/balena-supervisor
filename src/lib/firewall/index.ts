import * as _ from 'lodash';

import * as config from '../../config/index';
import * as constants from '../constants';
import * as iptables from './iptables';
import { log } from '../supervisor-console';

import * as dbFormat from '../../device-state/db-format';

export const initialised = (async () => {
	await config.initialized;
	await applyFirewall();

	// apply firewall whenever relevant config changes occur...
	config.on('change', async ({ firewallMode, localMode }) => {
		if (firewallMode || localMode !== undefined) {
			applyFirewall({ firewallMode, localMode });
		}
	});
})();

const BALENA_FIREWALL_CHAIN = 'BALENA-FIREWALL';
const LOG_PREFIX = '\u{1F525}';

const prepareChain: iptables.Rule[] = [
	{
		action: '-N',
	},
	{
		action: '-F',
	},
];

const standardServices: iptables.Rule[] = [
	{
		comment: 'SSH Server',
		action: '-A',
		proto: 'tcp',
		matches: ['--dport 22222'],
		target: 'ACCEPT',
	},
	{
		comment: 'balenaEngine',
		action: '-A',
		proto: 'tcp',
		matches: ['--dport 2375'],
		target: 'ACCEPT',
	},
	{
		comment: 'mDNS',
		action: '-A',
		matches: ['-m addrtype', '--dst-type MULTICAST'],
		target: 'ACCEPT',
	},
	{
		comment: 'ICMP',
		action: '-A',
		proto: 'icmp',
		target: 'ACCEPT',
	},
];

const standardPolicy: iptables.Rule[] = [
	{
		comment: 'Locally-sourced traffic',
		action: '-I',
		matches: ['-m addrtype', '--src-type LOCAL'],
		target: 'ACCEPT',
	},
	{
		action: '-I',
		matches: ['-m state', '--state ESTABLISHED,RELATED'],
		target: 'ACCEPT',
	},
	{
		comment: 'Reject everything else',
		action: '-A',
		target: 'REJECT',
	},
];

let supervisorAccessRules: iptables.Rule[] = [];
function updateSupervisorAccessRules(
	localMode: boolean,
	allowedInterfaces: string[],
	port: number,
) {
	supervisorAccessRules = [];

	// if localMode then we're listening on ALL interfaces, otherwise we listen only on the allowed ones...
	if (localMode) {
		supervisorAccessRules.push({
			comment: 'Supervisor API',
			action: '-A',
			proto: 'tcp',
			matches: [`--dport ${port}`],
			target: 'ACCEPT',
			applyIfExists: false,
		});
	} else {
		allowedInterfaces.forEach((intf) => {
			supervisorAccessRules.push({
				comment: 'Supervisor API',
				action: '-A',
				proto: 'tcp',
				matches: [`--dport ${port}`, `-i ${intf}`],
				target: 'ACCEPT',
				applyIfExists: false,
			});
		});
	}
}

async function runningHostBoundServices(): Promise<boolean> {
	const apps = await dbFormat.getApps();

	return _(apps).some((app) => _(app.services).some((svc) => svc.config.networkMode === 'host'));
}

async function applyFirewall(
	opts?: Partial<{ firewallMode: string | null; localMode: boolean }>,
) {
	// grab the current config...
	const currentConfig = await config.getMany([
		'listenPort',
		'firewallMode',
		'localMode',
	]);

	// populate missing config elements...
	const { listenPort, firewallMode, localMode } = _.defaults(
		opts,
		currentConfig,
	);

	// update the Supervisor API access rules...
	updateSupervisorAccessRules(
		localMode,
		constants.allowedInterfaces,
		listenPort,
	);

	// apply the firewall rules...
	await exports.applyFirewallMode(firewallMode ?? '');
}

export const AllowedModes = ['on', 'off', 'auto'];

export async function applyFirewallMode(mode: string) {
	// only apply valid mode...
	if (!AllowedModes.includes(mode)) {
		log.warn(`Invalid firewall mode: ${mode}. Reverting to state: off`);
		mode = "off";
	}

	log.info(`${LOG_PREFIX} Applying firewall mode: ${mode}`);

	// get an adaptor to manipulate iptables rules...
	const ruleAdaptor = iptables.getDefaultRuleAdaptor();

	// are we running services in host-network mode?
	const isServicesInHostNetworkMode = await runningHostBoundServices();

	// should we allow only traffic to the balena host services?
	const returnIfOff: iptables.Rule | iptables.Rule[] =
		mode === 'off' || (mode === 'auto' && !isServicesInHostNetworkMode)
			? {
				comment: `Firewall disabled (${mode})`,
				action: '-A',
				target: 'RETURN',
			}
			: [];

	// configure the BALENA-FIREWALL chain...
	await iptables
		.forChain(BALENA_FIREWALL_CHAIN, 'filter')
		.add(prepareChain)
		.add(returnIfOff)
		.add(standardServices)
		.add(standardPolicy)
		.apply(ruleAdaptor);

	// add the jump to the firewall table...
	await iptables
		.forChain('INPUT')
		.add({
			action: '-A',
			target: 'BALENA-FIREWALL',
			applyIfExists: false,
		})
		.apply(ruleAdaptor);

	// all done!
	log.success('Firewall mode applied');
}
