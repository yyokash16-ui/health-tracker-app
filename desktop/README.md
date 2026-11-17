# Health Tracker Windows installer

This packaging project creates an installed Windows x64 app from the existing, signed v2.0.5 update package at repository commit `d5589acbf8d2d8b6dec9ac2b281079c895ab47a7`. It verifies the Git blob identity, Ed25519 signature and every manifest file hash before packaging. The application payload is unchanged.

The stable shell protocol 1 source comes from the local Health Tracker 2.0 source distribution. It is included here with its filesystem/update-state helpers. This directory is a packaging project, not the complete current application development source.

The installer uses app ID `com.local.healthtracker`, product name `Health Tracker`, and the existing `%APPDATA%\Health Tracker` data directory. Existing update versions, backups and database remain in that directory. Uninstall is configured to retain app data. The custom signed `.htupdate` updater and its existing GitHub URL remain in the verified application payload.

Run `npm ci`, `npx electron-builder install-app-deps`, `npm run prepare:app`, `npm run smoke`, and `npm run dist` on Windows. Smoke runs use isolated temporary data directories, cover fresh startup and existing update/data state, and never open the user's real database. The build does not require the update private signing key. Never commit private keys or databases.

The NSIS installer removes the portable executable's repeated extraction step from normal installed-app launches. Startup timings from build smoke runs do not predict a particular computer's performance. This installer has no Windows Authenticode signature; the original update package's Ed25519 signature is verified independently.
