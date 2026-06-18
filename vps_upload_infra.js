const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({
  host: '64.235.61.6',
  username: 'administrator',
  password: 'dec39f2f3696983f'
}).then(async () => {
  await ssh.putFile('c:/Users/ammar/OneDrive/Documents/Legal Bhai/Legal Bhai Code/LEGALBAHI/infra_deploy.tar', 'C:\\LegalBahi\\infra_deploy.tar');
  await ssh.putFile('c:/Users/ammar/OneDrive/Documents/Legal Bhai/Legal Bhai Code/LEGALBAHI/vps_launch_infra.ps1', 'C:\\vps_launch_infra.ps1');
  ssh.dispose();
}).catch(err => {
  process.exit(1);
});
