const https = require('https');
const axios = require('axios');
const { decrypt } = require('../helpers');

class Api {
    constructor(params) {
        this.timeout = parseInt(params.timeout) || 5000; //request timeout

        this._isDebugMode = params.debug || false;

        this.email = params.email;
        this.password = params.password;
        this.otp = params.otp;
        this.client_id = params.CLIENT_ID;
        this.client_secret = params.CLIENT_SECRET;
        this.redirect_uri = params.REDIRECT_URI;

        this.axiosClient = axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });
    }

    /**
     * Utility function which returns the current time in the format hh:mm:ss.us.
     *
     * @private
     *
     * @returns {string} Current time in the format hh:mm:ss.us.
     */
    getTime() {
        var now = new Date();

        var paddingHead = function (num, size) {
            var str = num + '';

            while (str.length < size) {
                str = '0' + str;
            }

            return str;
        };

        var paddingTail = function (num, size) {
            var str = num + '';

            while (str.length < size) {
                str = str + '0';
            }

            return str;
        };

        return '' + paddingHead(now.getHours(), 2) + ':' + paddingHead(now.getMinutes(), 2) + ':' + paddingHead(now.getSeconds(), 2) + '.' + paddingTail(now.getMilliseconds(), 3);
    }

    _error = function (errorInfo, funcName) {
        var error = {
            debug: {
                date: this.getTime(),
                funcName: funcName
            }
        };

        if ('string' === typeof errorInfo) {
            error.error = {
                message: errorInfo
            };
        } else if ('object' === typeof errorInfo) {
            error.error = errorInfo;
        } else if ('number' === typeof errorInfo) {
            error.error = errorInfo;
        } else {
            error.error = {
                message: 'Invalid error info.'
            };
        }

        return error;
    };

    isLoggedIn(auth) {
        return (!!auth.access_token && (auth.time + auth.expires_in) > (new Date / 1e3 | 0)) ? true : false;
    };

    /**
     * Make a HTTP request.
     * Note, the response will always be in JSON format.
     *
     * @private
     *
     * @param {Object}  options             - Options.
     * @param {string}  options.method      - HTTP method ("GET", "POST", etc.).
     * @param {string}  options.path        - The path is the relative request URI, which will be appended to the base URI.
     * @param {Object}  [options.headers]   - HTTP request headers.
     * @param {Object}  [options.data]      - HTTP body data.
     *
     * @returns {Promise} Requested data.
     */
    _makeRequest = function (url = '', options, returnHeaders = false) {
        var funcName = '_makeRequest()';
        var _this = this;
        var reqOptions = options;

        if (true === _this._isDebugMode) {
            console.log(`this.url`, this.url);
        }

        if ('string' !== typeof options.path && url === '') {
            return Promise.reject(this._error('Path is missing.', funcName));
        }

        reqOptions.method = options.method;

        if (options.responseType) {
            reqOptions.responseType = options.responseType;
        }

        if (options.searchParams && 'object' === typeof options.searchParams) {
            reqOptions.params = qs.stringify(options.searchParams);
        }

        if (options.https && 'object' === typeof options.https) {
            reqOptions.https = options.https;
        }

        if (options.headers && 'object' === typeof options.headers) {
            reqOptions.headers = options.headers;
        }

        if (options.data && 'object' === typeof options.data) {
            reqOptions.data = options.data;
        }

        reqOptions.url = options.path ? options.path : url;

        if (true === _this._isDebugMode) {
            console.log(`reqOptions`, reqOptions);
        }

        return this.axiosClient(reqOptions)
            .then(function (result) {
                var description = '';

                if (true === _this._isDebugMode) {
                    // console.log(result);
                    console.log('----------');
                    console.log(JSON.stringify(result.headers, null, 2));
                    console.log(JSON.stringify(result.data, null, 2));
                    console.log('----------');
                }

                if (200 !== result.status) {
                    return Promise.reject(_this._error('Bad request.', funcName));
                }

                if (result.data.error) {
                    description = result.data.error;
                    return Promise.reject(_this._error(description, funcName));
                }

                if (typeof result.data.data === 'object') {
                    return Promise.resolve({ ...result.data.data, status: result.status });
                }

                if (returnHeaders) {
                    return Promise.resolve({ data: result.data, headers: {...result.headers}, location: result.request.res.responseUrl, status: result.status });
                }

                return Promise.resolve({ ...result.data, status: result.status });
            })
            .catch((error) => {
                if (true === _this._isDebugMode) {
                    console.log('error', error);
                }
                return Promise.resolve({ headers: {...error.headers}, location: error.request.path, status: error.status });
            });
    };

    /**
     * get the power State of your Diskstation
     * @param callback
     */
    getApps = async function (authObj) {
       console.log('[Function] => getApps')
       const bearer = await this._getBearer(authObj);
        const auth = bearer.auth;
        const apiUrl = 'https://apps-api.athom.com/api/v1/app/me';
        const options = {
            headers: {
                Authorization: `Bearer ${bearer.data}`
            },
            method: 'GET'
        };

        const response = await this._makeRequest(apiUrl, options, true);
        return {...response, auth};
    };

    _getBearer = async function (auth) {
        console.log('[Function] => _getBearer')
        let authResponse = null;
        if(!auth.refresh_token) {
            authResponse = await this._token();
        } else {
            authResponse = await this._refresh(auth);            
        }

        const apiUrl = 'https://api.athom.com/delegation/token?audience=apps';
        const params = {
            refresh_token: authResponse.refresh_token,
            client_id: this.client_id,
            client_secret: this.client_secret,
            grant_type: 'refresh_token'
        }

        const data = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&');

        const options = {
            headers: {
                "content-type": "application/x-www-form-urlencoded",
                Authorization: `Bearer ${authResponse.access_token}`
            },
            data,
            method: 'POST'
        };

        const response = await this._makeRequest(apiUrl, options, true);

        return {...response, auth: {...authResponse}};
    };

    /**
     * get the power State of your Diskstation
     * @param callback
     */
    _login = async function () {
        console.log('[Function] => _login')
        const apiUrl = 'https://accounts.athom.com/login';
        const options = {
            method: 'POST',
            data: {
                email: this.email,
                password: this.password,
                otptoken: this.otp
            }
        };

       const login = await this._makeRequest(apiUrl, options);
       if(!login.token) {
           throw new Error('No token found')
       }
       return login;
    };

    _authorizeOauth = async function () {
        console.log('[Function] => _authorizeOauth')
        const login = await this._login();
        const apiUrl = `https://accounts.athom.com/authorise?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&user_token=${login.token}&state=auth-callback&scope=homey&allow=Allow`;
        const options = {
            method: 'GET',
            mode: 'cors',
            credentials: 'include'
        };

        const response = await this._makeRequest(apiUrl, options, true);
        const cookieCsrf = response.headers['set-cookie'].find((c) => c.startsWith('_csrf='));
        let csrf = response.data.split('_csrf');
        csrf = csrf[1].match(/(?<=(?<![\w\d])value=(?![\w\d])\")(.*?)(?=")/g);
        return { ...login, cookieCsrf, csrf: csrf[0]  };
    };

    _authorize = async function () {
        console.log('[Function] => _authorize')
        const login = await this._authorizeOauth();
        const apiUrl = `https://accounts.athom.com/authorise?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&user_token=${login.token}&state=auth-callback&scope=homey&allow=Allow`;
        const params = {
            "allow": 'Allow',
            '_csrf': login.csrf
          };
          
          const data = Object.keys(params)
            .map((key) => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');
          
        const options = {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: login.cookieCsrf },
            data
        };

        const returnHeaders = true;
        const headers = await this._makeRequest(apiUrl, options, returnHeaders);

        let code = headers.location.split('code=')[1];
        code = code.replace('&state=auth-callback', '');

        return { ...login, code: code };
    };

    _token = async function () {
        console.log('[Function] => _token')
        const login = await this._authorize();
        const apiUrl = `https://api.athom.com/oauth2/token`;
       
        const params = {
            code: login.code,
            client_id: this.client_id,
            client_secret: this.client_secret,
            grant_type: 'authorization_code'
        }

        const data = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&');

        const options = {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data
        };

        const response = await this._makeRequest(apiUrl, options, true);

        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in,
            time: new Date(),
        };
    };

    _refresh = async function (auth) {
        console.log('[Function] => _refresh')
        const apiUrl = `https://api.athom.com/oauth2/token`;
       
        const params = {
            refresh_token: auth.refresh_token,
            client_id: this.client_id,
            client_secret: this.client_secret,
            grant_type: 'refresh_token'
        }

        const data = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&');

        const options = {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            data
        };

        const response = await this._makeRequest(apiUrl, options, true);

        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in,
            time: new Date(),
        };
    };
}

module.exports = Api;

