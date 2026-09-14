import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

type Tab = 'Map' | 'Weather' | 'Reports' | 'Journal' | 'Profile';
type WaypointType = 'Hunt Spot' | 'Camera' | 'Blind' | 'Food Plot' | 'Access';
type Waypoint = { id: string; name: string; latitude: number; longitude: number; private: boolean; type: WaypointType; color: string };
type Report = { id: string; location: string; birds: string; species: string; notes: string };
type Weather = {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  rain7d: number;
  humidity: number;
  condition: string;
  updatedAt: string;
  hourly: { time: string; temp: number; wind: number }[];
  daily: { date: string; high: number; low: number; rainChance: number; rain: number; wind: number }[];
};

const ORANGE = '#EF7C22';
const DEFAULT_REGION: Region = {
  latitude: 44.50,
  longitude: -89.50,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

const samplePhotos = [
  'https://images.unsplash.com/photo-1473445361085-b9a07f55608b?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1500463959177-e0869687df26?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=700&q=80',
];

export default function App() {
  const [tab, setTab] = useState<Tab>('Map');
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const mapRef = useRef<MapView>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [reportLocation, setReportLocation] = useState('');
  const [reportBirds, setReportBirds] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [mapType, setMapType] = useState<'hybrid' | 'satellite'>('hybrid');
  const [photoFilter, setPhotoFilter] = useState('24H');
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [mapControls, setMapControls] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [forecastRange, setForecastRange] = useState<'Hourly' | '3-Day' | '7-Day'>('Hourly');
  const [draftType, setDraftType] = useState<WaypointType>('Hunt Spot');
  const [draftColor, setDraftColor] = useState(ORANGE);

  const selected = useMemo(
    () => waypoints.find((point) => point.id === selectedId) ?? waypoints[0],
    [waypoints, selectedId]
  );

  useEffect(() => {
    void locateUser();
  }, []);

  async function locateUser() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const nextRegion = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.18,
        longitudeDelta: 0.18,
      };
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 650);
    } catch {
      // Keep the Wisconsin default when location is unavailable.
    }
  }

  function addWaypoint(latitude: number, longitude: number) {
    const point: Waypoint = {
      id: String(Date.now()),
      name: `Hunt Spot ${waypoints.length + 1}`,
      latitude,
      longitude,
      private: true,
      type: 'Hunt Spot',
      color: ORANGE,
    };
    setWaypoints((current) => [...current, point]);
    setSelectedId(point.id);
    setDraftName(point.name);
    setDraftType(point.type);
    setDraftColor(point.color);
    setWeather(null);
    setEditing(true);
  }

  async function refreshWeather(point?: Waypoint) {
    const target = point ?? selected;
    if (!target) return;
    try {
      setWeatherLoading(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.latitude}&longitude=${target.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,rain_sum,wind_speed_10m_max&past_days=7&forecast_days=7&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather service unavailable');
      const data = await response.json();
      const rain = (data.daily?.rain_sum ?? []) as number[];
      const codes: Record<number, string> = { 0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy', 45: 'Fog', 51: 'Drizzle', 61: 'Rain', 71: 'Snow', 80: 'Rain Showers', 95: 'Thunderstorms' };
      const times = (data.hourly?.time ?? []) as string[];
      const temps = (data.hourly?.temperature_2m ?? []) as number[];
      const winds = (data.hourly?.wind_speed_10m ?? []) as number[];
      const nowIndex = Math.max(0, times.findIndex((time) => new Date(time).getTime() >= Date.now()));
      setWeather({
        temperature: Number(data.current?.temperature_2m ?? 0),
        windSpeed: Number(data.current?.wind_speed_10m ?? 0),
        windDirection: Number(data.current?.wind_direction_10m ?? 0),
        pressure: Number(data.current?.surface_pressure ?? 0) * 0.02953,
        rain7d: rain.slice(0, 7).reduce((sum, value) => sum + Number(value || 0), 0),
        humidity: Number(data.current?.relative_humidity_2m ?? 0),
        condition: codes[Number(data.current?.weather_code)] ?? 'Current Conditions',
        updatedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        hourly: times.slice(nowIndex, nowIndex + 12).map((time, index) => ({
          time: new Date(time).toLocaleTimeString([], { hour: 'numeric' }),
          temp: Number(temps[nowIndex + index] ?? 0),
          wind: Number(winds[nowIndex + index] ?? 0),
        })),
        daily: ((data.daily?.time ?? []) as string[]).slice(-7).map((date, index) => ({
          date: new Date(date + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }),
          high: Number((data.daily?.temperature_2m_max ?? []).slice(-7)[index] ?? 0),
          low: Number((data.daily?.temperature_2m_min ?? []).slice(-7)[index] ?? 0),
          rainChance: Number((data.daily?.precipitation_probability_max ?? []).slice(-7)[index] ?? 0),
          rain: Number((data.daily?.rain_sum ?? []).slice(-7)[index] ?? 0),
          wind: Number((data.daily?.wind_speed_10m_max ?? []).slice(-7)[index] ?? 0),
        })),
      });
    } catch {
      Alert.alert('DuckCast weather', 'Current conditions could not be refreshed.');
    } finally {
      setWeatherLoading(false);
    }
  }

  function moveWaypoint(point: Waypoint, latitude: number, longitude: number) {
    const moved = { ...point, latitude, longitude };
    setWaypoints((current) => current.map((item) => item.id === point.id ? moved : item));
    setSelectedId(point.id);
    setWeather(null);
    void refreshWeather(moved);
  }

  async function importPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to import Tactacam images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotos((current) => [result.assets[0].uri, ...current]);
    }
  }

  function saveWaypointName() {
    const name = draftName.trim();
    if (!name || !selected) return;
    setWaypoints((current) => current.map((point) => point.id === selected.id ? { ...point, name, type: draftType, color: draftColor } : point));
    setEditing(false);
  }

  function togglePrivacy() {
    if (!selected) return;
    setWaypoints((current) => current.map((point) =>
      point.id === selected.id ? { ...point, private: !point.private } : point
    ));
  }

  function logHunt() {
    setJournalCount((count) => count + 1);
    Alert.alert('Hunt logged', 'Your waypoint, time and weather were added to the journal.');
  }

  function publishReport() {
    if (!reportLocation.trim() || !reportBirds.trim()) {
      Alert.alert('Add a location and bird count');
      return;
    }
    setReports((current) => [{
      id: String(Date.now()),
      location: reportLocation.trim(),
      birds: reportBirds.trim(),
      species: 'Waterfowl',
      notes: reportNotes.trim(),
    }, ...current]);
    setReportBirds('');
    setReportNotes('');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <BrandHeader />
      <View style={styles.body}>
        {tab === 'Map' && (selected ? (
          <ScrollView contentContainerStyle={styles.mapPage} showsVerticalScrollIndicator={false}>
            <View style={styles.mapCard}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                mapType={mapType}
                initialRegion={region}
                onRegionChangeComplete={setRegion}
                showsUserLocation
                showsCompass={false}
                onLongPress={(event) => addWaypoint(
                  event.nativeEvent.coordinate.latitude,
                  event.nativeEvent.coordinate.longitude
                )}
              >
                {showWaypoints && waypoints.map((point) => (
                  <Marker
                    key={point.id}
                    coordinate={point}
                    title={showLabels ? `${point.type}: ${point.name}` : undefined}
                    pinColor={point.color}
                    draggable
                    onPress={() => { setSelectedId(point.id); setWeather(null); void refreshWeather(point); }}
                    onDragEnd={(event) => moveWaypoint(point, event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}
                  />
                ))}
              </MapView>
              <View style={styles.mapTopRow}>
                <Pressable
                  style={styles.glassButton}
                  onPress={() => setRegion({ ...DEFAULT_REGION, latitude: selected.latitude, longitude: selected.longitude })}
                >
                  <Text style={styles.glassText}>‹  Back</Text>
                </Pressable>
                <View style={styles.mapTools}>
                  <Pressable style={[styles.squareButton, styles.actionButton]} onPress={() => setMapControls(true)}>
                    <Text style={styles.toolIcon}>☰</Text>
                  </Pressable>
                  <Pressable style={styles.squareButton} onPress={locateUser}>
                    <Text style={styles.toolIcon}>➤</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.markerLabel}>
                <View style={styles.cameraPin}><Text style={styles.cameraPinText}>●</Text></View>
                <Text style={styles.markerText}>{selected.name}</Text>
              </View>
              <View style={styles.scale}><Text style={styles.scaleText}>0      500      1,000 ft</Text></View>
              <Pressable style={styles.privatePill} onPress={togglePrivacy}>
                <Text style={styles.privateText}>▣  {selected.private ? 'Private' : 'Shared'}</Text>
              </Pressable>
            </View>

            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text style={styles.locationTitle}>{selected.name}</Text>
                <Text style={styles.privateLine}>▣  {selected.private ? 'Private' : 'Shared'} · {selected.type}</Text>
                <Text style={styles.coordinates}>
                  {selected.latitude.toFixed(4)}° N, {Math.abs(selected.longitude).toFixed(4)}° W
                </Text>
              </View>
              <Pressable style={styles.editButton} onPress={() => { setDraftName(selected.name); setEditing(true); }}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
              <Pressable style={styles.moreButton} onPress={togglePrivacy}>
                <Text style={styles.moreText}>•••</Text>
              </Pressable>
            </View>

            <WeatherPanel weather={weather} loading={weatherLoading} onRefresh={() => refreshWeather()} />

            <View style={styles.cameraSection}>
              <View style={styles.cameraHeader}>
                <View>
                  <View style={styles.tactacamRow}>
                    <Text style={styles.tactacam}>TACTACAM</Text>
                    <Text style={styles.reveal}> REVEAL</Text>
                  </View>
                  <Text style={styles.subtle}>Trail Camera Photos</Text>
                </View>
                <Pressable style={styles.importButton} onPress={importPhoto}>
                  <Text style={styles.importText}>↓  Import Photos</Text>
                </Pressable>
              </View>
              <View style={styles.filters}>
                {['24H', '7D', '30D', 'All'].map((filter) => (
                  <Pressable
                    key={filter}
                    style={[styles.filter, photoFilter === filter && styles.filterActive]}
                    onPress={() => setPhotoFilter(filter)}
                  >
                    <Text style={[styles.filterText, photoFilter === filter && styles.filterTextActive]}>{filter}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photos.map((uri, index) => (
                  <Pressable style={styles.photoCard} key={uri + index} onPress={() => setActivePhoto(uri)}>
                    <Image source={{ uri }} style={styles.photo} />
                    <View style={styles.photoShade}>
                      <Text style={styles.photoDate}>Jan 14 · {index === 2 ? '4:58 PM' : `7:${12 + index * 24} AM`}</Text>
                    </View>
                    <View style={styles.photoMeta}>
                      <Text style={styles.photoSpecies}>{index === 1 ? 'Canada Goose' : 'Mallard'}</Text>
                      <Text style={styles.photoBirds}>{18 + index * 3} birds</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Pressable style={styles.insight} onPress={() => Alert.alert('DuckCast Insight', 'Northwest winds between 6–9 AM produced the most camera activity at this waypoint.')}>
              <View style={styles.chartIcon}><Text style={styles.chartText}>▮▮▮</Text></View>
              <View style={styles.flex}>
                <Text style={styles.insightTitle}>DuckCast Insight</Text>
                <Text style={styles.insightMain}>Most activity: NW winds, 6–9 AM.</Text>
                <Text style={styles.insightSub}>Based on recent trail-camera activity at this location.</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <View style={styles.emptyMapWrap}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              mapType={mapType}
              initialRegion={region}
              onRegionChangeComplete={setRegion}
              showsUserLocation
              showsCompass
              onLongPress={(event) => addWaypoint(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)}
            />
            <View style={styles.emptyMapTools}>
              <Pressable style={[styles.squareButton, styles.actionButton]} onPress={() => setMapControls(true)}>
                <Text style={styles.toolIcon}>☰</Text>
              </Pressable>
              <Pressable style={styles.squareButton} onPress={locateUser}><Text style={styles.toolIcon}>➤</Text></Pressable>
            </View>
            <View style={styles.cleanSlateCard}>
              <Text style={styles.cleanSlateTitle}>Build your DuckCast map</Text>
              <Text style={styles.cleanSlateText}>Pan and zoom anywhere. Long-press the map to create your first waypoint and load live weather for that exact spot.</Text>
            </View>
          </View>
        ))}

        {tab === 'Weather' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.eyebrow}>LIVE CONDITIONS</Text>
            <Text style={styles.pageTitle}>Marsh Weather</Text>
            <WeatherPanel weather={weather} loading={weatherLoading} onRefresh={() => refreshWeather()} />
            <View style={styles.forecastTabs}>
              {(['Hourly', '3-Day', '7-Day'] as const).map((range) => (
                <Pressable key={range} style={[styles.forecastTab, forecastRange === range && styles.forecastTabActive]} onPress={() => setForecastRange(range)}>
                  <Text style={[styles.forecastTabText, forecastRange === range && styles.forecastTabTextActive]}>{range}</Text>
                </Pressable>
              ))}
            </View>
            {weather && forecastRange === 'Hourly' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.largeForecastRail}>
                {weather.hourly.map((hour) => (
                  <View style={styles.largeHourCard} key={hour.time}>
                    <Text style={styles.hourTime}>{hour.time}</Text>
                    <Text style={styles.largeHourTemp}>{hour.temp.toFixed(0)}°</Text>
                    <Text style={styles.hourWind}>➤ {hour.wind.toFixed(0)} mph</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            {weather && forecastRange !== 'Hourly' && (
              <View style={styles.dailyForecast}>
                {weather.daily.slice(0, forecastRange === '3-Day' ? 3 : 7).map((day) => (
                  <View style={styles.dayRow} key={day.date}>
                    <Text style={styles.dayName}>{day.date}</Text>
                    <Text style={styles.dayRain}>● {day.rainChance.toFixed(0)}% · {day.rain.toFixed(2)} in</Text>
                    <Text style={styles.dayWind}>➤ {day.wind.toFixed(0)}</Text>
                    <Text style={styles.dayTemps}>{day.high.toFixed(0)}°  <Text style={styles.dayLow}>{day.low.toFixed(0)}°</Text></Text>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Waypoint forecast</Text>
              {waypoints.map((point) => (
                <Pressable key={point.id} style={styles.listRow} onPress={() => { setSelectedId(point.id); setTab('Map'); }}>
                  <View><Text style={styles.rowTitle}>{point.name}</Text><Text style={styles.subtle}>{point.latitude.toFixed(3)}, {point.longitude.toFixed(3)}</Text></View>
                  <Text style={styles.rowValue}>{weather.windSpeed.toFixed(0)} mph  ›</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {tab === 'Reports' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.eyebrow}>COMMUNITY FIELD INTEL</Text>
            <Text style={styles.pageTitle}>Waterfowl Reports</Text>
            <View style={styles.panel}>
              <TextInput style={styles.input} placeholder="Location or marsh" placeholderTextColor="#778079" value={reportLocation} onChangeText={setReportLocation} />
              <TextInput style={styles.input} placeholder="Bird count" placeholderTextColor="#778079" keyboardType="number-pad" value={reportBirds} onChangeText={setReportBirds} />
              <TextInput style={[styles.input, styles.notes]} placeholder="Migration, pressure, species and notes…" placeholderTextColor="#778079" multiline value={reportNotes} onChangeText={setReportNotes} />
              <Pressable style={styles.primaryButton} onPress={publishReport}><Text style={styles.primaryButtonText}>Publish Report</Text></Pressable>
            </View>
            {reports.map((report) => (
              <View style={styles.panel} key={report.id}>
                <View style={styles.reportTop}><Text style={styles.panelTitle}>{report.location}</Text><Text style={styles.reportCount}>{report.birds}</Text></View>
                <Text style={styles.reveal}>{report.species}</Text>
                <Text style={styles.subtle}>{report.notes || 'No additional field notes.'}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {tab === 'Journal' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.eyebrow}>YOUR SEASON</Text>
            <Text style={styles.pageTitle}>Hunt Journal</Text>
            <View style={styles.heroPanel}>
              <Text style={styles.heroNumber}>{journalCount}</Text>
              <Text style={styles.heroLabel}>hunts logged this season</Text>
              <Pressable style={styles.primaryButton} onPress={logHunt}><Text style={styles.primaryButtonText}>＋ Log a Hunt</Text></Pressable>
            </View>
            <View style={styles.panel}><Text style={styles.panelTitle}>Your journal is ready</Text><Text style={styles.subtle}>Save weather, location, birds seen, harvest details, dog work and photos after each hunt.</Text></View>
          </ScrollView>
        )}

        {tab === 'Profile' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.eyebrow}>BEARDED DUCK</Text>
            <Text style={styles.pageTitle}>Field Profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>J</Text></View>
              <Text style={styles.profileName}>Jake</Text>
              <Text style={styles.subtle}>Wisconsin · Arkansas</Text>
            </View>
            {['Saved Waypoints', 'Tactacam Connections', 'Privacy & Sharing', 'Weather Settings'].map((label) => (
              <Pressable style={styles.settingsRow} key={label} onPress={() => Alert.alert(label, 'This DuckCast setting is ready for account connection.')}>
                <Text style={styles.rowTitle}>{label}</Text><Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      <Modal visible={mapControls} transparent animationType="fade" onRequestClose={() => setMapControls(false)}>
        <Pressable style={styles.controlBackdrop} onPress={() => setMapControls(false)}>
          <View style={styles.mapControlCard}>
            <Text style={styles.mapControlTitle}>Map Display</Text>
            <Pressable style={styles.controlRow} onPress={() => setShowWaypoints((value) => !value)}>
              <Text style={styles.rowTitle}>Waypoints</Text><Text style={styles.controlValue}>{showWaypoints ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable style={styles.controlRow} onPress={() => setShowLabels((value) => !value)}>
              <Text style={styles.rowTitle}>Waypoint Labels</Text><Text style={styles.controlValue}>{showLabels ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable style={styles.controlRow} onPress={() => setMapType((value) => value === 'hybrid' ? 'satellite' : 'hybrid')}>
              <Text style={styles.rowTitle}>Map Style</Text><Text style={styles.controlValue}>{mapType.toUpperCase()}</Text>
            </Pressable>
            <Text style={styles.controlHint}>Long-press to add · Drag a marker to move it</Text>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit Waypoint</Text>
            <Text style={styles.sheetLabel}>WAYPOINT NAME</Text>
            <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} autoFocus />
            <Text style={styles.sheetLabel}>TYPE</Text>
            <View style={styles.optionWrap}>
              {(['Hunt Spot', 'Camera', 'Blind', 'Food Plot', 'Access'] as WaypointType[]).map((type) => (
                <Pressable key={type} style={[styles.typeOption, draftType === type && styles.typeOptionActive]} onPress={() => setDraftType(type)}>
                  <Text style={[styles.typeOptionText, draftType === type && styles.optionTextActive]}>{type}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetLabel}>MARKER COLOR</Text>
            <View style={styles.colorRow}>
              {['#EF7C22', '#D7B43A', '#4EA66D', '#3C92D1', '#9C68C7', '#D95858'].map((color) => (
                <Pressable key={color} style={[styles.colorDot, { backgroundColor: color }, draftColor === color && styles.colorDotActive]} onPress={() => setDraftColor(color)} />
              ))}
            </View>
            <Pressable style={styles.privacyRow} onPress={togglePrivacy}>
              <View>
                <Text style={styles.rowTitle}>{selected?.private ? 'Private waypoint' : 'Shared waypoint'}</Text>
                <Text style={styles.subtle}>Tap to change who can see this location.</Text>
              </View>
              <Text style={styles.privacyValue}>{selected?.private ? 'PRIVATE' : 'SHARED'}</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={saveWaypointName}>
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!activePhoto} transparent animationType="fade" onRequestClose={() => setActivePhoto(null)}>
        <Pressable style={styles.photoModal} onPress={() => setActivePhoto(null)}>
          {!!activePhoto && <Image source={{ uri: activePhoto }} style={styles.fullPhoto} resizeMode="contain" />}
          <View style={styles.closePhoto}><Text style={styles.closePhotoText}>×</Text></View>
        </Pressable>
      </Modal>

      <BottomTabs active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

function BrandHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <Text style={styles.duckMark}>◆</Text>
        <View>
          <Text style={styles.brand}>DuckCast</Text>
          <Text style={styles.byline}>BY BEARDED DUCK</Text>
        </View>
      </View>
      <View style={styles.dogBlock}>
        <Text style={styles.dog}>●ᴥ●</Text>
        <Text style={styles.tagline}>{`WATER\nBIRDS\nBETTER\nDAYS.`}</Text>
      </View>
    </View>
  );
}

function WeatherPanel({ weather, loading, onRefresh }: { weather: Weather | null; loading: boolean; onRefresh: () => void }) {
  if (!weather) {
    return (
      <Pressable style={styles.weatherPanel} onPress={onRefresh}>
        <Text style={styles.weatherTitle}>☁  Waypoint Weather</Text>
        <Text style={styles.weatherEmpty}>{loading ? 'Loading live conditions…' : 'Select a waypoint to load live weather.'}</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.weatherPanel}>
      <Pressable style={styles.weatherHeadingRow} onPress={onRefresh}>
        <Text style={styles.weatherTitle}>☁  Waypoint Weather</Text>
        <Text style={styles.refreshText}>{loading ? 'Loading…' : `Updated ${weather.updatedAt}  ↻`}</Text>
      </Pressable>
      <View style={styles.weatherMetrics}>
        <View style={styles.weatherMain}>
          <Text style={styles.temperature}>{weather.temperature.toFixed(0)}°<Text style={styles.degreeF}>F</Text></Text>
          <Text style={styles.condition}>{weather.condition}</Text>
        </View>
        <Metric icon="➤" label={`${weather.windDirection.toFixed(0)}°`} value={`${weather.windSpeed.toFixed(0)} mph`} sub="Wind" />
        <Metric icon="●" label="7-Day Rain" value={`${weather.rain7d.toFixed(1)} in`} sub={`${weather.humidity.toFixed(0)}% humidity`} />
        <Metric icon="◴" label="Pressure" value={`${weather.pressure.toFixed(2)} in`} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyRail}>
        {weather.hourly.map((hour) => (
          <View style={styles.hourCard} key={hour.time}>
            <Text style={styles.hourTime}>{hour.time}</Text>
            <Text style={styles.hourTemp}>{hour.temp.toFixed(0)}°</Text>
            <Text style={styles.hourWind}>{hour.wind.toFixed(0)} mph</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Metric({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <View style={styles.weatherMetric}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {!!sub && <Text style={styles.metricSub}>{sub}</Text>}
    </View>
  );
}

function BottomTabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: { tab: Tab; icon: string }[] = [
    { tab: 'Map', icon: '●' },
    { tab: 'Weather', icon: '☁' },
    { tab: 'Reports', icon: '▮▮' },
    { tab: 'Journal', icon: '▤' },
    { tab: 'Profile', icon: '●' },
  ];
  return (
    <View style={styles.tabs}>
      {items.map((item) => (
        <Pressable key={item.tab} style={styles.tab} onPress={() => onChange(item.tab)}>
          <Text style={[styles.tabIcon, active === item.tab && styles.activeText]}>{item.icon}</Text>
          <Text style={[styles.tabLabel, active === item.tab && styles.activeText]}>{item.tab}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#081510' },
  body: { flex: 1 },
  flex: { flex: 1 },
  header: { height: 96, paddingHorizontal: 18, paddingTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0A1A13', borderBottomWidth: 1, borderBottomColor: '#23372E' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  duckMark: { color: ORANGE, fontSize: 31, transform: [{ rotate: '45deg' }] },
  brand: { color: '#EADCCB', fontSize: 31, fontWeight: '800', fontFamily: 'Georgia', letterSpacing: -1.2 },
  byline: { color: '#B9B4AA', fontSize: 10, fontWeight: '800', letterSpacing: 3.2, marginTop: 1 },
  dogBlock: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dog: { color: '#69776E', fontSize: 22 },
  tagline: { color: '#9CA39D', fontSize: 8, lineHeight: 10, fontWeight: '800', letterSpacing: 1.1 },
  mapPage: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 22, gap: 12 },
  emptyMapWrap: { flex: 1, backgroundColor: '#14231B' },
  emptyMapTools: { position: 'absolute', right: 14, top: 14, gap: 9 },
  actionButton: { backgroundColor: 'rgba(239,124,34,0.94)', borderColor: '#FFB16F' },
  cleanSlateCard: { position: 'absolute', left: 15, right: 15, bottom: 18, padding: 16, borderRadius: 15, backgroundColor: 'rgba(8,21,16,0.94)', borderWidth: 1, borderColor: '#536158' },
  cleanSlateTitle: { color: '#EADCCB', fontFamily: 'Georgia', fontSize: 21, fontWeight: '800' },
  cleanSlateText: { color: '#A5AEA8', lineHeight: 19, marginTop: 5 },
  mapCard: { height: 285, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#38463F', backgroundColor: '#1A2A20' },
  mapTopRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  glassButton: { backgroundColor: 'rgba(5,13,9,0.78)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  glassText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  mapTools: { gap: 8 },
  squareButton: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5,13,9,0.82)', borderWidth: 1, borderColor: '#566159' },
  toolIcon: { color: '#FFFFFF', fontSize: 21 },
  markerLabel: { position: 'absolute', alignSelf: 'center', top: 91, alignItems: 'center' },
  cameraPin: { width: 46, height: 55, borderRadius: 25, backgroundColor: ORANGE, borderWidth: 3, borderColor: '#FFF4E8', alignItems: 'center', justifyContent: 'center' },
  cameraPinText: { color: '#142019', fontSize: 21 },
  markerText: { marginTop: 5, color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.66)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, fontWeight: '800' },
  scale: { position: 'absolute', left: 14, bottom: 14 },
  scaleText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  privatePill: { position: 'absolute', right: 12, bottom: 11, backgroundColor: 'rgba(5,13,9,0.82)', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
  privateText: { color: '#FFFFFF', fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  locationTitle: { color: '#EADCCB', fontSize: 29, lineHeight: 34, fontWeight: '800', fontFamily: 'Georgia', letterSpacing: -0.8 },
  privateLine: { color: '#E9E5DD', fontSize: 14, marginTop: 2 },
  coordinates: { color: '#8D9991', marginTop: 5, fontSize: 13 },
  editButton: { borderWidth: 1, borderColor: '#69756D', borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11 },
  editText: { color: '#D0D2CC', fontSize: 15 },
  moreButton: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, borderColor: '#59675E', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#D0D2CC', letterSpacing: 2 },
  weatherPanel: { marginHorizontal: 1, backgroundColor: '#13231B', borderWidth: 1, borderColor: '#3A4B42', borderRadius: 16, padding: 13 },
  weatherTitle: { color: '#E7DAC9', fontSize: 18, fontWeight: '800' },
  weatherHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  refreshText: { color: ORANGE, fontSize: 10, fontWeight: '800' },
  weatherEmpty: { color: '#9FA9A3', paddingVertical: 18, textAlign: 'center' },
  hourlyRail: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#34463C', paddingTop: 10 },
  hourCard: { width: 65, alignItems: 'center', paddingVertical: 7, marginRight: 6, borderRadius: 9, backgroundColor: '#0C1A13' },
  hourTime: { color: '#96A099', fontSize: 10 },
  hourTemp: { color: '#F1E7D8', fontSize: 17, fontWeight: '800', marginTop: 3 },
  hourWind: { color: ORANGE, fontSize: 9, marginTop: 2 },
  weatherMetrics: { flexDirection: 'row' },
  weatherMain: { width: '25%', justifyContent: 'center', paddingRight: 7, borderRightWidth: 1, borderRightColor: '#59645E' },
  temperature: { color: '#FFFFFF', fontSize: 37, fontWeight: '800' },
  degreeF: { fontSize: 18 },
  condition: { color: '#A4ADA7', fontSize: 11 },
  weatherMetric: { width: '25%', minHeight: 82, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#59645E' },
  metricIcon: { color: '#BEC6C0', fontSize: 18 },
  metricLabel: { color: '#9FA9A3', fontSize: 9, marginTop: 3 },
  metricValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginTop: 2 },
  metricSub: { color: '#A4ADA7', fontSize: 9, marginTop: 2 },
  cameraSection: { paddingTop: 2, gap: 10 },
  cameraHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tactacamRow: { flexDirection: 'row', alignItems: 'center' },
  tactacam: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  reveal: { color: '#A9CE35', fontSize: 15, fontWeight: '900' },
  subtle: { color: '#96A099', fontSize: 13, lineHeight: 19 },
  importButton: { backgroundColor: ORANGE, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11 },
  importText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  filters: { flexDirection: 'row', gap: 7 },
  filter: { flex: 1, height: 39, borderRadius: 9, borderWidth: 1, borderColor: '#405047', alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  filterText: { color: '#E3E6E2', fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  photoCard: { width: 170, marginRight: 9 },
  photo: { width: 170, height: 144, borderRadius: 10, backgroundColor: '#1C2A22' },
  photoShade: { position: 'absolute', top: 111, left: 0, right: 0, height: 33, padding: 7, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.46)', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
  photoDate: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  photoMeta: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  photoSpecies: { color: '#E7DAC9', fontSize: 12, fontWeight: '800' },
  photoBirds: { color: '#E7DAC9', fontSize: 12 },
  insight: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#14231B', borderWidth: 1, borderColor: '#415048', borderRadius: 15, padding: 14 },
  chartIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center' },
  chartText: { color: ORANGE, fontWeight: '900', fontSize: 19 },
  insightTitle: { color: ORANGE, fontWeight: '800', fontSize: 13 },
  insightMain: { color: '#F2E9DC', fontWeight: '700', fontSize: 15, marginTop: 3 },
  insightSub: { color: '#7F8B83', fontSize: 10, marginTop: 3 },
  chevron: { color: '#E6E8E4', fontSize: 29 },
  tabs: { height: 73, flexDirection: 'row', backgroundColor: '#09150F', borderTopWidth: 1, borderTopColor: '#33433A', paddingTop: 7 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIcon: { color: '#89938D', fontSize: 20, fontWeight: '800' },
  tabLabel: { color: '#89938D', fontSize: 11, fontWeight: '600' },
  activeText: { color: ORANGE },
  page: { padding: 16, paddingBottom: 35, gap: 13 },
  eyebrow: { color: ORANGE, fontWeight: '900', letterSpacing: 2, fontSize: 10 },
  pageTitle: { color: '#EADCCB', fontWeight: '800', fontFamily: 'Georgia', fontSize: 34, letterSpacing: -1 },
  panel: { backgroundColor: '#122219', borderWidth: 1, borderColor: '#33463B', borderRadius: 16, padding: 15, gap: 10 },
  panelTitle: { color: '#EADCCB', fontWeight: '800', fontSize: 18 },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#2C3C33' },
  rowTitle: { color: '#EEE8DE', fontWeight: '700', fontSize: 15 },
  rowValue: { color: ORANGE, fontWeight: '800' },
  input: { backgroundColor: '#0A1710', borderWidth: 1, borderColor: '#3A4B41', borderRadius: 11, padding: 12, color: '#F4EEE5' },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: ORANGE, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between' },
  reportCount: { color: ORANGE, fontSize: 24, fontWeight: '900' },
  heroPanel: { backgroundColor: '#13231B', borderWidth: 1, borderColor: '#3A4D42', borderRadius: 18, alignItems: 'center', padding: 24, gap: 7 },
  heroNumber: { color: ORANGE, fontSize: 58, fontWeight: '900' },
  heroLabel: { color: '#A8B0AA', marginBottom: 12 },
  profileCard: { alignItems: 'center', backgroundColor: '#13231B', borderWidth: 1, borderColor: '#3A4D42', borderRadius: 18, padding: 24 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#0B1710', fontSize: 28, fontWeight: '900' },
  profileName: { color: '#EADCCB', fontSize: 24, fontWeight: '800' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#122219', borderBottomWidth: 1, borderBottomColor: '#33463B', padding: 16 },
  forecastTabs: { flexDirection: 'row', gap: 7, backgroundColor: '#0D1B14', padding: 5, borderRadius: 12, borderWidth: 1, borderColor: '#314238' },
  forecastTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  forecastTabActive: { backgroundColor: ORANGE },
  forecastTabText: { color: '#98A29B', fontWeight: '800', fontSize: 12 },
  forecastTabTextActive: { color: '#FFFFFF' },
  largeForecastRail: { marginVertical: 2 },
  largeHourCard: { width: 82, minHeight: 98, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 13, backgroundColor: '#13231B', borderWidth: 1, borderColor: '#34463C' },
  largeHourTemp: { color: '#F1E7D8', fontSize: 25, fontWeight: '900', marginVertical: 7 },
  dailyForecast: { backgroundColor: '#122219', borderWidth: 1, borderColor: '#34463C', borderRadius: 15, overflow: 'hidden' },
  dayRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: '#2A3A31' },
  dayName: { width: 42, color: '#F0E6D9', fontWeight: '900' },
  dayRain: { flex: 1, color: '#73A9CC', fontSize: 11 },
  dayWind: { width: 52, color: '#B5BEB7', fontSize: 11 },
  dayTemps: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  dayLow: { color: '#89958D' },
  controlBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' },
  mapControlCard: { position: 'absolute', top: 128, right: 18, width: 245, backgroundColor: '#0E1D15', borderRadius: 17, borderWidth: 1, borderColor: '#506158', padding: 15 },
  mapControlTitle: { color: '#EADCCB', fontFamily: 'Georgia', fontSize: 21, fontWeight: '800', marginBottom: 7 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 47, borderBottomWidth: 1, borderBottomColor: '#293A31' },
  controlValue: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  controlHint: { color: '#7F8C84', fontSize: 10, marginTop: 11, lineHeight: 15 },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typeOption: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: '#3A4B41' },
  typeOptionActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  typeOptionText: { color: '#ADB5AF', fontSize: 11, fontWeight: '800' },
  optionTextActive: { color: '#FFFFFF' },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#0E1D15' },
  colorDotActive: { borderColor: '#FFFFFF', transform: [{ scale: 1.12 }] },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)' },
  sheet: { backgroundColor: '#0E1D15', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#3A4B41', padding: 20, paddingBottom: 34, gap: 12 },
  sheetHandle: { width: 46, height: 5, borderRadius: 3, backgroundColor: '#536158', alignSelf: 'center', marginBottom: 5 },
  sheetTitle: { color: '#EADCCB', fontFamily: 'Georgia', fontWeight: '800', fontSize: 28 },
  sheetLabel: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1.6, marginTop: 4 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#13231B', borderWidth: 1, borderColor: '#34463B', borderRadius: 12, padding: 13 },
  privacyValue: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#A9B1AB', fontWeight: '700' },
  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: '100%', height: '78%' },
  closePhoto: { position: 'absolute', top: 54, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(18,35,27,0.9)', alignItems: 'center', justifyContent: 'center' },
  closePhotoText: { color: '#FFFFFF', fontSize: 30, lineHeight: 32 },
});
