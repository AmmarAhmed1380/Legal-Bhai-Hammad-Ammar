# PostgreSQL Restore Drill

1. Create a disposable empty PostgreSQL database. Never point this drill at the live production database.
2. Download one encrypted object from the R2 backup bucket.
3. Copy `.env.production` to a temporary restore environment file. Change only `DATABASE_URL` to the disposable database and confirm `BACKUP_AGE_IDENTITY` points to the private age key.
4. Run:

```powershell
.\infra\windows\restore-postgres.ps1 `
  -EncryptedBackup C:\LegalBahi\backups\legalbahi-YYYYMMDD-HHMMSS.dump.age `
  -EnvironmentFile C:\LegalBahi\.env.restore-drill
```

5. Verify all expected rows exist in `schema_migrations`, then compare firm, matter, document metadata, notification job, and audit-event counts with production.
6. Open at least one restored matter and verify its title, next hearing, document metadata, and client membership.
7. Delete the disposable database and temporary restore environment file.
8. Record the restore date, backup object, duration, and result. A successful recorded restore is required before pilot launch.

## Drill record

- Date: June 13, 2026
- Scope: local PostgreSQL 17 custom-format dump restored into a clean disposable database
- Result: passed; all five migration rows and all four normalized registry/template tables were restored into a clean database
- Remaining launch proof: download, decrypt, and restore an encrypted object from the separate R2 backup bucket on the Windows VPS
