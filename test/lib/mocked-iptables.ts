import _ = require('lodash');
import { expect } from 'chai';

import * as firewall from '../../src/lib/firewall';
import * as iptables from '../../src/lib/iptables';
import { EventEmitter } from 'events';

class FakeRuleAdaptor {
	private rules: iptables.Rule[];

	constructor() {
		this.rules = [];
	}

	public getRuleAdaptor(): iptables.RuleAdaptor {
		return this.ruleAdaptor.bind(this);
	}

	private async ruleAdaptor(rule: iptables.Rule): Promise<string> {
		// remove any undefined values from the object...
		for (const key of Object.getOwnPropertyNames(rule)) {
			if ((rule as any)[key] === undefined) {
				delete (rule as any)[key];
			}
		}

		// never store this value...
		delete rule.applyIfExists;

		switch (rule.action) {
			case '-N':
				if (
					_.some(
						this.rules,
						(r) =>
							r.family === rule.family &&
							r.action === '-N' &&
							r.chain === rule.chain &&
							r.table === rule.table,
					)
				) {
					throw new iptables.IPTablesRuleError('Chain exists');
				}
				break;
			case '-L':
				if (
					!_.some(
						this.rules,
						(r) =>
							r.family === rule.family &&
							r.action === '-N' &&
							r.chain === rule.chain &&
							r.table === rule.table,
					)
				) {
					throw new iptables.IPTablesRuleError("Chain doesn't exist");
				}
				break;
			case '-C':
				if (!_.some(this.rules, rule)) {
					throw new iptables.IPTablesRuleError("Rule doesn't exist");
				}
		}

		this.rules.push(rule);
		return '';
	}

	private isSameRule(
		partial: Partial<iptables.Rule>,
		rule: iptables.Rule,
	): boolean {
		const props = Object.getOwnPropertyNames(partial);
		for (const prop of props) {
			if (
				_.get(rule, prop) === undefined ||
				!_.isEqual(_.get(rule, prop), _.get(partial, prop))
			) {
				return false;
			}
		}

		return true;
	}

	public expectRule(testRule: Partial<iptables.Rule>) {
		return expect(
			_.some(this.rules, (r) => this.isSameRule(testRule, r)),
		).to.eq(true, `Rule has not been applied: ${JSON.stringify(testRule)}`);
	}
	public expectNoRule(testRule: Partial<iptables.Rule>) {
		return expect(
			_.some(this.rules, (r) => this.isSameRule(testRule, r)),
		).to.eq(false, `Rule has been applied: ${JSON.stringify(testRule)}`);
	}
	public clearHistory() {
		this.rules = [];
	}
}

const fakeRuleAdaptor = new FakeRuleAdaptor();
// @ts-expect-error Assigning to a RO property
iptables.getDefaultRuleAdaptor = () => fakeRuleAdaptor.getRuleAdaptor();

export interface MockedState {
	hasAppliedRules: Promise<void>;
	expectRule: (rule: iptables.Rule) => void;
	expectNoRule: (rule: iptables.Rule) => void;
	clearHistory: () => void;
}

export type MockedConext = (state: MockedState) => Promise<any>;

const applyFirewallRules = firewall.applyFirewallMode;
export const whilstMocked = async (context: MockedConext) => {
	fakeRuleAdaptor.clearHistory();

	const applied = new EventEmitter();

	// @ts-expect-error Assigning to a RO property
	firewall.applyFirewallMode = async (mode: string) => {
		await applyFirewallRules(mode);
		applied.emit('applied');
	};

	await context({
		expectRule: (rule) => fakeRuleAdaptor.expectRule(rule),
		expectNoRule: (rule) => fakeRuleAdaptor.expectNoRule(rule),
		clearHistory: () => fakeRuleAdaptor.clearHistory(),
		hasAppliedRules: new Promise((resolve) => {
			applied.once('applied', () => resolve());
		}),
	});

	// @ts-expect-error Assigning to a RO property
	firewall.applyFirewallMode = applyFirewallRules;
};
