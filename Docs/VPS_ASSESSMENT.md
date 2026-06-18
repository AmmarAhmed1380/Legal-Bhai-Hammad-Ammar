# Current Windows VPS Assessment

## Read-only assessment on June 13, 2026

- Windows Server 2022 Standard with about 16 GB RAM and 160 GB disk.
- Node.js 22, npm, Git, SSH, and RDP are available.
- PostgreSQL, Caddy, NSSM, `age`, AWS CLI, and `C:\Legal Bhai` are not installed or created.
- Ports `80` and `443` are not currently serving traffic.
- SSH (`22`) and RDP (`3389`) are reachable from the internet.
- The host already runs unrelated trading, bridge, history, access, and Python services.
- Host-level listeners also include SMB and WinRM; provider-level filtering prevented external WinRM access during the assessment.

## Decision required before deployment

The controlled pilot will hold real lawyer and client data. A dedicated VPS is the recommended production target because it gives Legal Bhai an independent security boundary, maintenance window, backup lifecycle, and incident blast radius.

Using the current shared VPS is not approved by this assessment until the owner explicitly accepts the co-hosting risk and confirms that the existing trading services can tolerate PostgreSQL, Caddy, backup jobs, and Legal Bhai service maintenance.

## Required host actions after the decision

1. Take a provider snapshot before installing prerequisites.
2. Restrict SSH and RDP to trusted administrator IPs.
3. Permit public inbound traffic only to Caddy on `80` and `443`; do not expose PostgreSQL, Legal Bhai loopback ports, SMB, or WinRM.
4. Install PostgreSQL, Caddy, NSSM, `age`, PostgreSQL client tools, and AWS CLI.
5. Use separate least-privilege R2 tokens for documents and encrypted backups.
6. Deploy using [DEPLOYMENT.md](DEPLOYMENT.md), then run `verify-production-host.ps1 -RunSmoke`.
7. Complete and record the encrypted R2 restore drill before inviting pilot users.
