Health Tracker v2.0.5 is now available as a Windows x64 installer.

- Installs the verified v2.0.5 application payload, including the existing earlier-window and delayed-update startup improvements.
- Installed launches avoid the portable executable's extraction step.
- Retains the existing `%APPDATA%\Health Tracker` database, backups, update history and signed update mechanism.
- Includes the original signed full update package for existing users, build provenance, checksums and isolated startup/data-preservation check results.

Close Health Tracker before installing, then launch the installed app from Start. The existing portable executable is not removed. This installer is not Windows Authenticode signed, so Windows may display a publisher warning. The updater package retains its original Ed25519 signature.
