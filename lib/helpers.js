const Homey = require('homey');
const crypto = require('crypto');

const algorithm = 'aes-256-ctr';

exports.sleep = async function (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

exports.decrypt = function (hash) {
    const secret = Homey.env.SECRET;
    const splittedHash = hash.split('+');
    const decipher = crypto.createDecipheriv(algorithm, secret, Buffer.from(splittedHash[0], 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(splittedHash[1], 'hex')), decipher.final()]);

    return decrpyted.toString();
};