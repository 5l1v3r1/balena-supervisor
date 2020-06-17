import * as _ from 'lodash';
import { child_process } from 'mz';

export class IPTablesRuleError extends Error {}

export interface Rule {
	id?: number;
	family?: 4 | 6;
	action?: '-L' | '-I' | '-A' | '-D' | '-C' | '-N' | '-F' | '-X';
	target?: 'ACCEPT' | 'BLOCK' | 'REJECT' | string;
	chain?: string;
	table?: 'filter' | string;
	proto?: 'all' | any;
	src?: string;
	dest?: string;
	matches?: string[];
	applyIfExists?: boolean;
	comment?: string;
}

export interface RuleBuilder {
	add: (rules: Rule | Rule[]) => RuleBuilder;
	apply: (adaptor: RuleAdaptor) => Promise<void>;
}

export type RuleAdaptor = (rule: Rule) => Promise<string>;
export function getDefaultRuleAdaptor(): RuleAdaptor {
	return iptables;
}

const iptables: RuleAdaptor = async (rule: Rule) => {
	const args: string[] = [];

	if (rule.action) {
		args.push(rule.action);
	}
	if (rule.chain) {
		args.push(rule.chain);
	}
	if (rule.action === '-L') {
		args.push('--line-numbers');
		args.push('-n');
	}
	if (rule.table) {
		args.push(`-t ${rule.table}`);
	}
	if (rule.proto) {
		args.push(`-p ${rule.proto}`);
	}
	if (rule.matches) {
		rule.matches.forEach((match) => args.push(match));
	}
	if (rule.comment) {
		args.push('-m comment');
		args.push(`--comment "${rule.comment}"`);
	}
	if (rule.target) {
		args.push(`-j ${rule.target}`);
	}

	if (!rule.family) {
		rule.family = 4;
	}

	const cmd = rule.family === 6 ? 'ip6tables' : 'iptables';
	return new Promise<string>((resolve, reject) => {
		const proc = child_process.spawn(cmd, args, { shell: true });

		const stdout: string[] = [];
		proc.stdout.on('data', (data: Buffer) => {
			stdout.push(data.toString('utf8'));
		});

		const stderr: string[] = [];
		proc.stderr.on('data', (data: Buffer) => {
			stderr.push(data.toString('utf8'));
		});

		proc.on('error', (err) => reject(err));
		proc.on('close', (code) => {
			if (code && code !== 0) {
				return reject(
					new IPTablesRuleError(
						`Error running iptables: ${stderr.join()} (${args.join(' ')})`,
					),
				);
			}
			return resolve(stdout.join());
		});
	});
};

export function forChain(chain: string, table?: string): RuleBuilder {
	const builder = {
		rules: new Array<Rule>(),
		add: (r: Rule) => {
			const newRules = _.castArray(r);
			builder.rules.push(
				...newRules.map((rule) => {
					return {
						...rule,
						...{
							chain,
							table,
						},
					};
				}),
			);
			return builder;
		},
		apply: async (adaptor: RuleAdaptor) => {
			await applyRules(builder.rules, adaptor);
		},
	};
	return builder;
}

async function applyRule(rule: Rule, adaptor: RuleAdaptor) {
	if (!rule.family) {
		rule.family = 6;
		applyRule(
			{
				...rule,
				...{
					family: 4,
				},
			},
			adaptor,
		);
	}

	if (rule.applyIfExists !== undefined) {
		try {
			await adaptor({
				...rule,
				...{
					action: '-C',
				},
			});

			if (!rule.applyIfExists) {
				return;
			}
		} catch {
			if (!rule.applyIfExists) {
				return await adaptor(rule);
			}
			return;
		}
	} else if (rule.action === '-N') {
		try {
			return await adaptor({
				...rule,
				...{
					action: '-L',
				},
			});
		} catch {
			return await adaptor(rule);
		}
	}

	return await adaptor(rule);
}

async function applyRules(rules: Rule[], adaptor: RuleAdaptor) {
	for (const rule of rules) {
		await applyRule(rule, adaptor);
	}
}
