const { Client } = require('ssh2');

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET') {
    process.exit(0);
  } else {
    console.error('Unhandled Error:', err);
    process.exit(1);
  }
});

const conn = new Client();
const cmd = process.argv[2];

if (!cmd) {
  console.error("Usage: node vps_exec.js '<powershell-command>'");
  process.exit(1);
}

conn.on('ready', () => {
  const b64 = Buffer.from(cmd, 'utf16le').toString('base64');
  conn.exec(`powershell -ExecutionPolicy Bypass -EncodedCommand ${b64}`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
      process.exit(code || 0);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '64.235.61.6',
  port: 22,
  username: 'administrator',
  password: 'dec39f2f3696983f'
});
