const bcrypt = require('bcryptjs');

const hash = '$2a$12$VOBgatT9NnhAPsztxghay.Zb4o2p33U0G9mX.VimJpRCefxmirZS2';
const pw = 'iflow123';

console.log(bcrypt.compareSync(pw, hash));
