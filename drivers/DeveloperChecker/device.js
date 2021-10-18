const Homey = require('homey');
const API = require('../../lib/homey');
const { sleep } = require('../../lib/helpers');

module.exports = class DeveloperChecker extends Homey.Device {
    async onInit() {
        const settings = this.getSettings();

        await this.checkCapabilities();

        this.homey.app.log(`[Device] ${this.getName()} - [onInit] - Loaded settings`, {...settings, email: "LOG", password: 'LOG', AUTH: {acces_token: 'LOG', refresh_token: 'LOG'}});
        
        this._apiClient = await new API({...settings, ...Homey.env});

        if (!settings.AUTH && !settings.AUTH.acces_token) {
            const auth = this._apiClient.getBearer();
            await this.setSettings({ ...settings, AUTH: auth });
        }

        await this.InitFinder(true);
        await this.setAvailable();
    }

    onDeleted() {
        if( this.onPollInterval ) {
            this.homey.clearInterval(this.onPollInterval);
        }
    }

    async checkCapabilities() {
        const driverManifest = this.driver.manifest;
        const driverCapabilities = driverManifest.capabilities;

        const deviceCapabilities = this.getCapabilities();

        this.homey.app.log(`[Device] ${this.getName()} - Found capabilities =>`, deviceCapabilities);
        this.homey.app.log(`[Device] ${this.getName()} - Driver capabilities =>`, driverCapabilities);

        if (deviceCapabilities.length !== driverCapabilities.length) {
            await this.updateCapabilities(driverCapabilities, deviceCapabilities);
        }

        return deviceCapabilities;
    }

    async updateCapabilities(driverCapabilities, deviceCapabilities) {
        this.homey.app.log(`[Device] ${this.getName()} - Add new capabilities =>`, driverCapabilities);
        try {
            deviceCapabilities.forEach((c) => {
                this.removeCapability(c);
            });
            await sleep(2000);
            driverCapabilities.forEach((c) => {
                this.addCapability(c);
            });
            await sleep(2000);
        } catch (error) {
            this.homey.app.log(error);
        }
    }

    async setInitFinderInterval(clear = false) {
        const REFRESH_INTERVAL = 1000 * (3 * 60);

        if (clear) {
            this.homey.app.log(`[Device] ${this.getName()} - [onPollInterval] - Clearinterval`);
            this.homey.clearInterval(this.onPollInterval);
        }

        this.homey.app.log(`[Device] ${this.getName()} - [onPollInterval]`, REFRESH_INTERVAL);
        this.onPollInterval = this.homey.setInterval(this.InitFinder.bind(this), REFRESH_INTERVAL);
    }

    async InitFinder(initial = false, force = false) {
        try {
            await this.findApps();

            if (initial) {
                await sleep(9000);
                await this.setInitFinderInterval();
            }
        } catch (error) {
            this.error(error);
        }
    }

    async findApps() {
        const settings = this.getSettings();
        const appArray = settings.APPS;

        this.homey.app.log(`[Device] ${this.getName()} - [findapps] - appArray: `, appArray);

        let apps = await this._apiClient.getApps(settings.AUTH);

        if (!apps.data) return;
        const auth = apps.auth;
        apps = Object.values(apps.data).map((f) => ({ name: f.liveBuild ? f.liveBuild.name.en : f.testBuild.name.en, id: f.id, installs: f.installs }));

        let totalInstalls = 0;

        apps.forEach((app) => {
            totalInstalls = totalInstalls + app.installs;
        });

        await this.setSettings({ ...settings, APPS: [...new Set(apps)], AUTH: auth });
        await this.setCapabilityValue('measure_installs', totalInstalls);
        await this.checkAppDiff(apps, appArray);
    }

    async checkAppDiff(apps, appArray) {
        try {
            const appDiff = apps.filter((a, index) => !!appArray[index] && a.installs > appArray[index].installs);
            const appDiffReverse = appArray.filter((a, index) => !!apps[index] && a.installs > apps[index].installs);

            this.homey.app.log(`[Device] ${this.getName()} - [appDiff] - appDiff: `, appDiff);
            this.homey.app.log(`[Device] ${this.getName()} - [appDiffReverse] - appDiffReverse: `, appDiffReverse);

            appDiff.forEach(async (app) => {
                await this.homey.flow
                    .getDeviceTriggerCard(`trigger_INSTALL_ADD`)
                    .trigger(this, { app: app.name, id: app.id, install: app.installs })
                    .catch(this.error)
                    .then(this.homey.app.log(`[Device] ${this.getName()} - [appDiff] trigger_INSTALL_ADD - Triggered: "${app.name} | ${app.id} | ${app.installs}"`));
            });

            appDiffReverse.forEach(async (app) => {
                await this.homey.flow
                    .getDeviceTriggerCard(`trigger_INSTALL_REMOVE`)
                    .trigger(this, { app: app.name, id: app.id, install: app.installs })
                    .catch(this.error)
                    .then(this.homey.app.log(`[Device] ${this.getName()} - [appDiff] trigger_INSTALL_REMOVE - Triggered: "${app.name} | ${app.id} | ${app.installs}"`));
            });
        } catch (error) {
            this.error(error);
        }
    }
};
