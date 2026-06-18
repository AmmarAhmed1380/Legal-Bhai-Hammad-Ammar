const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({
  host: '64.235.61.6',
  username: 'administrator',
  password: 'dec39f2f3696983f'
}).then(async () => {
  console.log('Uploading legalbahi_deploy.tar...');
  await ssh.putFile('c:/Users/ammar/OneDrive/Documents/Legal Bhai/Legal Bhai Code/LEGALBAHI/legalbahi_deploy.tar', 'C:\\legalbahi_deploy.tar');
  console.log('Done uploading tar.');
  ssh.dispose();
}).catch(err => {
  console.error('SSH Error:', err);
  process.exit(1);
});
