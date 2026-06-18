const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({
  host: '64.235.61.6',
  username: 'administrator',
  password: 'dec39f2f3696983f'
}).then(async () => {
  await ssh.putFile('c:/Users/ammar/OneDrive/Documents/Legal Bhai/Legal Bhai Code/LEGALBAHI/vps_nssm_mirror.ps1', 'C:\\vps_nssm_mirror.ps1');
  ssh.dispose();
}).catch(err => {
  process.exit(1);
});
