const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.join(process.cwd(), 'keys');

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR);
}

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });
}

const { publicKey, privateKey } = generateKeyPair();

console.log('RSA key pair generated successfully!');
console.log('Public key:');
console.log('');
console.log(publicKey);
console.log('');
console.log('Private key:');
console.log('');
console.log(privateKey);
