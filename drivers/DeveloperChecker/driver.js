const Homey = require('homey');
const API = require('../../lib/homey');

module.exports = class DeveloperChecker extends Homey.Driver {
    onInit() {
        this.homey.app.log('[Driver] - init', this.id);
        this.homey.app.log(`[Driver] - version`, Homey.manifest.version);
    }

    async onPair(session) {
        session.setHandler("login", async (data) => {
            try {
                this.config = {

                };
                this.config = {
                    ...Homey.env,
                    'email': data.username,
                    'password': data.password,
                    'otp': data.otp
                }

                this.homey.app.log(`[Driver] ${this.id} - got config`, {...this.config, email: "LOG", password: 'LOG'});
            
                this._apiClient = await new API(this.config);
                
                this.homeydata = await this._apiClient._getBearer({});
            } catch (error) {
                throw new Error(this.homey.__('pair.error'));
            }
        });

        session.setHandler("list_devices", async () => {
            let results = [];

            this.homey.app.log(`[Driver] ${this.id} - this.homeydata`, this.homeydata);

            if(!this.homeydata || !this.homeydata.data && !this.homeydata.data.token_type) {
                throw new Error(this.homey.__('pair.error'));
            }

            results.push({
                name: `Developer Checker - ${this.config.email}`,
                data: {
                    id: `${this.id}-${this.config.email}`,
                },
                settings: {
                    ...this.config,
                    AUTH: this.homeydata.data,
                    APPS: []
                }
            });

            this.homey.app.log(`[Driver] ${this.id} - Found devices - `, results);

            return results;
        });
    }
}