# DuckCast by Bearded Duck

DuckCast is a native iPhone/Android waterfowl hunting app prototype built with Expo + React Native.

## MVP features

- Interactive hunting map with GPS location
- Long-press map waypoint creation
- Weather tied to exact waypoint coordinates
- Current temperature, wind speed/direction, current precipitation
- 24-hour and 7-day rain totals
- Community-style waterfowl report entry
- Trail-camera / Tactacam photo library scaffold
- Dark Bearded Duck field UI

## Run locally

```bash
npm install
npx expo start
```

Then open with Expo Go or a development build on iPhone/Android.

## Weather

The MVP uses Open-Meteo for coordinate-based weather so it works without a private API key during development.

## Trail cameras

The current build supports importing trail-camera photos from the device photo library. Direct Tactacam account syncing is intentionally left as an integration layer until an approved API/export method is available.

## Next build targets

1. Persistent user accounts and cloud storage
2. Saved waypoint editing, icons, notes, and folders
3. Satellite/topographic map layers
4. Weather forecast timeline and migration conditions
5. Rain history charts by waypoint
6. Shared/public hunting reports with privacy controls
7. Trail-camera photo association by waypoint
8. Push alerts for weather and reports
9. Offline maps and cached waypoints
10. App Store / Play Store release pipeline
