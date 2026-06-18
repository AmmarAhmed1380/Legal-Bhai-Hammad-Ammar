const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

ssh.connect({
  host: '64.235.61.6',
  username: 'administrator',
  password: 'dec39f2f3696983f'
}).then(async () => {
  console.log('Uploading legalbahi_deploy.zip...');
  await ssh.putFile('c:/Users/ammar/OneDrive/Documents/Legal Bhai/Legal Bhai Code/LEGALBAHI/legalbahi_deploy.zip', 'C:\\legalbahi_deploy.zip');
  console.log('Done uploading zip.');
  ssh.dispose();
}).catch(err => {
  console.error('SSH Error:', err);
  process.exit(1);
});
