import { spy } from 'sinon';
import { expect } from 'chai';

import * as config from '../src/config';
import * as firewall from '../src/lib/firewall';
import * as iptablesMock from './lib/mocked-iptables';
import * as targetStateCache from '../src/device-state/target-state-cache';

import constants = require('../src/lib/constants');

describe('Host Firewall', function () {
	let apiEndpoint: string;
	let listenPort: number;

	before(async function () {
		await firewall.initialised;
		await targetStateCache.initialized;

		apiEndpoint = await config.get('apiEndpoint');
		listenPort = await config.get('listenPort');
	});

	describe('Basic On/Off operation', () => {
		it('should confirm the `changed` event is handled', async function () {
			await iptablesMock.whilstMocked(async ({ hasAppliedRules }) => {
				const changedSpy = spy();
				config.on('change', changedSpy);

				// set the firewall to be in off mode...
				await config.set({ firewallMode: 'off' });
				await hasAppliedRules;

				// check it fired the events correctly...
				expect(changedSpy.called).to.be.true;
				expect(changedSpy.calledWith({ firewallMode: 'off' })).to.be.true;
			});
		});

		it('should handle the HOST_FIREWALL_MODE configuration value: invalid', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule }) => {
					// set the firewall to be in off mode...
					await config.set({ firewallMode: 'invalid' });
					await hasAppliedRules;

					// expect that we created the chain...
					expectRule({
						action: '-N',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						family: 4,
					});

					// expect that we jump to the firewall chain...
					expectRule({
						action: '-A',
						target: 'BALENA-FIREWALL',
						chain: 'INPUT',
						family: 4,
					});

					// expect to return...
					expectRule({
						action: '-A',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						target: 'RETURN',
						family: 4,
					});
				},
			);
		});

		it('should respect the HOST_FIREWALL_MODE configuration value: off', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule, expectNoRule }) => {
					// set the firewall to be in off mode...
					await config.set({ firewallMode: 'off' });
					await hasAppliedRules;

					// expect that we created the chain...
					expectRule({
						action: '-N',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						family: 4,
					});

					// expect that we jump to the firewall chain...
					expectRule({
						action: '-A',
						target: 'BALENA-FIREWALL',
						chain: 'INPUT',
						family: 4,
					});

					// expect to return...
					expectRule({
						action: '-A',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						target: 'RETURN',
						family: 4,
					});
				},
			);
		});

		it('should respect the HOST_FIREWALL_MODE configuration value: on', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule, expectNoRule }) => {
					// set the firewall to be in auto mode...
					await config.set({ firewallMode: 'on' });
					await hasAppliedRules;

					// expect that we created the chain...
					expectRule({
						action: '-N',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						family: 4,
					});

					// expect that we DO have a rule to use the chain...
					expectRule({
						action: '-A',
						target: 'BALENA-FIREWALL',
						chain: 'INPUT',
						family: 4,
					});

					// expect to not return...
					expectNoRule({
						action: '-A',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						target: 'RETURN',
						family: 4,
					});
				},
			);
		});

		it('should respect the HOST_FIREWALL_MODE configuration value: auto (no services in host-network)', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule, expectNoRule }) => {
					await targetStateCache.setTargetApps([
						{
							appId: 2,
							commit: 'abcdef2',
							name: 'test-app2',
							source: apiEndpoint,
							releaseId: 1232,
							services: JSON.stringify([
								{
									serviceName: 'test-service',
									image: 'test-image',
									imageId: 5,
									environment: {
										TEST_VAR: 'test-string',
									},
									tty: true,
									appId: 2,
									releaseId: 1232,
									serviceId: 567,
									commit: 'abcdef2',
								},
							]),
							networks: '{}',
							volumes: '{}',
						},
					]);

					// set the firewall to be in auto mode...
					await config.set({ firewallMode: 'auto' });
					await hasAppliedRules;

					// expect that we created the chain...
					expectRule({
						action: '-N',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						family: 4,
					});

					// expect that we DO have a rule to use the chain...
					expectRule({
						action: '-A',
						target: 'BALENA-FIREWALL',
						chain: 'INPUT',
						family: 4,
					});

					// expect to return...
					expectRule({
						action: '-A',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						target: 'RETURN',
						family: 4,
					});
				},
			);
		});

		it('should respect the HOST_FIREWALL_MODE configuration value: auto (service in host-network)', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule, expectNoRule }) => {
					await targetStateCache.setTargetApps([
						{
							appId: 2,
							commit: 'abcdef2',
							name: 'test-app2',
							source: apiEndpoint,
							releaseId: 1232,
							services: JSON.stringify([
								{
									serviceName: 'test-service',
									networkMode: 'host',
									image: 'test-image',
									imageId: 5,
									environment: {
										TEST_VAR: 'test-string',
									},
									tty: true,
									appId: 2,
									releaseId: 1232,
									serviceId: 567,
									commit: 'abcdef2',
								},
							]),
							networks: '{}',
							volumes: '{}',
						},
					]);

					// set the firewall to be in auto mode...
					await config.set({ firewallMode: 'auto' });
					await hasAppliedRules;

					// expect that we created the chain...
					expectRule({
						action: '-N',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						family: 4,
					});

					// expect that we DO have a rule to use the chain...
					expectRule({
						action: '-A',
						target: 'BALENA-FIREWALL',
						chain: 'INPUT',
						family: 4,
					});

					// expect to return...
					expectNoRule({
						action: '-A',
						table: 'filter',
						chain: 'BALENA-FIREWALL',
						target: 'RETURN',
						family: 4,
					});
				},
			);
		});
	});

	describe.skip('Supervisor API access', () => {
		it('should allow access in localmode', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule }) => {
					// set the device to be in local mode...
					await config.set({ localMode: true });
					await hasAppliedRules;

					// make sure we have a rule to allow traffic on ANY interface
					[4, 6].forEach((family: 4 | 6) => {
						expectRule({
							action: '-A',
							proto: 'tcp',
							matches: [`--dport ${listenPort}`],
							target: 'ACCEPT',
							chain: 'BALENA-FIREWALL',
							table: 'filter',
							family,
						});
					});
				},
			);
		});
		it('should allow limited access in non-localmode', async function () {
			await iptablesMock.whilstMocked(
				async ({ hasAppliedRules, expectRule, expectNoRule }) => {
					// set the device to be in local mode...
					await config.set({ localMode: false });
					await hasAppliedRules;

					// ensure we have no unrestricted rule...
					expectNoRule({
						action: '-A',
						chain: 'BALENA-FIREWALL',
						table: 'filter',
						proto: 'tcp',
						matches: [`--dport ${listenPort}`],
						target: 'ACCEPT',
						family: 4,
					});

					// ensure we do have a restricted rule for each interface...
					constants.allowedInterfaces.forEach((intf) => {
						[4, 6].forEach((family: 4 | 6) => {
							expectRule({
								action: '-A',
								chain: 'BALENA-FIREWALL',
								table: 'filter',
								proto: 'tcp',
								matches: [`--dport ${listenPort}`, `-i ${intf}`],
								target: 'ACCEPT',
								family,
							});
						});
					});
				},
			);
		});
	});
});
