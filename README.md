# THE INNER CIRCLE

A dark, cinematic friendship and party game for Android. Players create private rooms, join with a code, complete secret missions and dares, spin the Dare Wheel, and compete on a live leaderboard.

## What's included
- Expo / React Native Android app with a dark cinematic interface
- Private room creation and room-code joining
- Socket.IO multiplayer updates and live player leaderboard
- Secret mission delivery and +10 point scoring
- Dare Wheel interaction
- SQLite-backed server data; rooms and scores persist across server restarts

## Project structure
- `App.tsx` — mobile app
- `server/index.js` — Socket.IO multiplayer server
- `eas.json` — internal APK build profile

## Run the mobile app
```bash
npm install
npx expo start
```
Open Expo Go on Android and scan the QR code. Set `EXPO_PUBLIC_SERVER_URL` to your deployed multiplayer server URL before starting the app. For local testing on a physical Android phone, use your computer's LAN IP address, not `localhost`.

## Run the multiplayer server
Requires Node.js 20+.
```bash
cd server
npm install
npm start
```
For persistent hosting, mount a persistent disk at `/data` and set `DB_PATH=/data/innercircle.sqlite`. The server exposes `/health` for health checks.

## Build a directly installable Android APK
The project is configured for an internal APK build:
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```
An Expo account is required for EAS cloud builds. This repository currently contains the app source and build configuration; an APK has not yet been generated.

## Important next deployment step
Deploy `server/` as a persistent Node service and set `EXPO_PUBLIC_SERVER_URL` to its public HTTPS URL when building the app. The client currently defaults to `http://localhost:3000` for local development.
