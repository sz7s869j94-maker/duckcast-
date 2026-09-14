import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

type Tab = 'Map' | 'Weather' | 'Reports' | 'Cameras';
type Waypoint = { id: string; name: string; latitude: number; longitude: number };
type Report = { id: string; location: string; species: string; birds: string; notes: string; createdAt: string };
type Weather = {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  rain24h: number;
  rain7d: number;
};

const DEFAULT_REGION: Region = {
  latitude: 44.5,
  longitude: -89.5,
  latitudeDelta: 5.5,
  longitudeDelta: 5.5,
};

const tabs: Tab[] = ['Map', 'Weather', 'Reports', 'Cameras'];

export default function App() {
  const [tab, setTab] = useState<Tab>('Map');
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportLocation, setReportLocation] = useState('');
  const [reportSpecies, setReportSpecies] = useState('Mallards');
  const [reportBirds, setReportBirds] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [cameraPhotos, setCameraPhotos] = useState<string[]>([]);

  const selectedWaypoint = useMemo(
    () => waypoints.find((w) => w.id === selectedWaypointId) ?? waypoints[0] ?? null,
    [waypoints, selectedWaypointId]
  );

  useEffect(() => {
    void requestLocation();
  }, []);

  useEffect(() => {
    if (tab === 'Weather' && selectedWaypoint) void loadWeather(selectedWaypoint);
  }, [tab, selectedWaypointId]);

  async function requestLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setRegion({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      latitudeDelta: 0.35,
      longitudeDelta: 0.35,
    });
  }

  function addWaypoint(latitude: number, longitude: number) {
    const waypoint: Waypoint = {
      id: `${Date.now()}`,
      name: `Hunt Spot ${waypoints.length + 1}`,
      latitude,
      longitude,
    };
    setWaypoints((current) => [...current, waypoint]);
    setSelectedWaypointId(waypoint.id);
  }

  async function loadWeather(point: Waypoint) {
    try {
      setWeatherLoading(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}&longitude=${point.longitude}&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m&daily=rain_sum,precipitation_sum&past_days=7&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather service unavailable');
      const data = await response.json();
      const rain = (data.daily?.rain_sum ?? []) as number[];
      const precip = (data.daily?.precipitation_sum ?? []) as number[];
      const combined = rain.map((v, i) => Number(v || 0) + Number(precip[i] || 0));
      setWeather({
        temperature: Number(data.current?.temperature_2m ?? 0),
        windSpeed: Number(data.current?.wind_speed_10m ?? 0),
        windDirection: Number(data.current?.wind_direction_10m ?? 0),
        precipitation: Number(data.current?.precipitation ?? 0),
        rain24h: combined.at(-1) ?? 0,
        rain7d: combined.slice(-7).reduce((sum, v) => sum + v, 0),
      });
    } catch (error) {
      Alert.alert('Weather error', error instanceof Error ? error.message : 'Unable to load conditions.');
    } finally {
      setWeatherLoading(false);
    }
  }

  function submitReport() {
    if (!reportLocation.trim() || !reportBirds.trim()) {
      Alert.alert('Add a location and bird count');
      return;
    }
    setReports((current) => [
      {
        id: `${Date.now()}`,
        location: reportLocation.trim(),
        species: reportSpecies.trim() || 'Waterfowl',
        birds: reportBirds.trim(),
        notes: reportNotes.trim(),
        createdAt: new Date().toLocaleString(),
      },
      ...current,
    ]);
    setReportBirds('');
    setReportNotes('');
  }

  async function addCameraPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access to add Tactacam or trail-camera images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]?.uri) {
      setCameraPhotos((current) => [result.assets[0].uri, ...current]);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>DUCKCAST</Text>
          <Text style={styles.byline}>by Bearded Duck</Text>
        </View>
        <View style={styles.livePill}><Text style={styles.liveText}>● LIVE CONDITIONS</Text></View>
      </View>

      <View style={styles.content}>
        {tab === 'Map' && (
          <View style={styles.flex}>
            <MapView
              style={styles.flex}
              region={region}
              onRegionChangeComplete={setRegion}
              showsUserLocation
              showsCompass
              onLongPress={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                addWaypoint(latitude, longitude);
              }}
            >
              {waypoints.map((waypoint) => (
                <Marker
                  key={waypoint.id}
                  coordinate={waypoint}
                  title={waypoint.name}
                  description="Tap for weather"
                  pinColor="#D78B2D"
                  onPress={() => setSelectedWaypointId(waypoint.id)}
                />
              ))}
            </MapView>
            <View style={styles.mapHint}>
              <Text style={styles.mapHintTitle}>Long-press the map to drop a waypoint</Text>
              <Text style={styles.muted}>{waypoints.length} saved spot{waypoints.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
        )}

        {tab === 'Weather' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.sectionTitle}>Waypoint Weather</Text>
            {waypoints.length === 0 ? (
              <View style={styles.card}><Text style={styles.cardTitle}>No waypoint selected</Text><Text style={styles.muted}>Drop a pin on the map first.</Text></View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                  {waypoints.map((w) => (
                    <Pressable key={w.id} style={[styles.chip, selectedWaypoint?.id === w.id && styles.chipActive]} onPress={() => setSelectedWaypointId(w.id)}>
                      <Text style={styles.chipText}>{w.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={styles.coordinate}>{selectedWaypoint?.latitude.toFixed(4)}, {selectedWaypoint?.longitude.toFixed(4)}</Text>
                <Pressable style={styles.primaryButton} onPress={() => selectedWaypoint && loadWeather(selectedWaypoint)}><Text style={styles.buttonText}>{weatherLoading ? 'Loading…' : 'Refresh Conditions'}</Text></Pressable>
                {weather && (
                  <View style={styles.grid}>
                    <Metric label="TEMP" value={`${weather.temperature.toFixed(0)}°F`} />
                    <Metric label="WIND" value={`${weather.windSpeed.toFixed(0)} mph`} sub={`${weather.windDirection.toFixed(0)}°`} />
                    <Metric label="RAIN 24H" value={`${weather.rain24h.toFixed(2)} in`} />
                    <Metric label="RAIN 7D" value={`${weather.rain7d.toFixed(2)} in`} />
                    <Metric label="CURRENT PRECIP" value={`${weather.precipitation.toFixed(2)} in`} />
                  </View>
                )}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>DuckCast field note</Text>
                  <Text style={styles.muted}>Weather is tied to the exact waypoint coordinates, so you can compare wind and rain accumulation at individual marshes, fields, and flooded food plots.</Text>
                </View>
              </>
            )}
          </ScrollView>
        )}

        {tab === 'Reports' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.sectionTitle}>Waterfowl Reports</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Post a report</Text>
              <TextInput style={styles.input} placeholder="Location / marsh" placeholderTextColor="#7A8079" value={reportLocation} onChangeText={setReportLocation} />
              <TextInput style={styles.input} placeholder="Species" placeholderTextColor="#7A8079" value={reportSpecies} onChangeText={setReportSpecies} />
              <TextInput style={styles.input} placeholder="Bird count" placeholderTextColor="#7A8079" keyboardType="number-pad" value={reportBirds} onChangeText={setReportBirds} />
              <TextInput style={[styles.input, styles.notes]} placeholder="Migration, pressure, water level, notes…" placeholderTextColor="#7A8079" multiline value={reportNotes} onChangeText={setReportNotes} />
              <Pressable style={styles.primaryButton} onPress={submitReport}><Text style={styles.buttonText}>Publish Report</Text></Pressable>
            </View>
            {reports.map((report) => (
              <View style={styles.card} key={report.id}>
                <View style={styles.reportRow}><Text style={styles.cardTitle}>{report.location}</Text><Text style={styles.count}>{report.birds}</Text></View>
                <Text style={styles.reportSpecies}>{report.species}</Text>
                {!!report.notes && <Text style={styles.muted}>{report.notes}</Text>}
                <Text style={styles.timestamp}>{report.createdAt}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {tab === 'Cameras' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.sectionTitle}>Trail Cameras</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tactacam / trail-cam photos</Text>
              <Text style={styles.muted}>Add photos now. Direct Tactacam account syncing can be connected later if an approved API or export feed is available.</Text>
              <Pressable style={styles.primaryButton} onPress={addCameraPhoto}><Text style={styles.buttonText}>Add Camera Photo</Text></Pressable>
            </View>
            <View style={styles.photoGrid}>
              {cameraPhotos.map((uri) => <Image key={uri} source={{ uri }} style={styles.photo} />)}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable key={item} style={styles.tab} onPress={() => setTab(item)}>
            <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {sub ? <Text style={styles.muted}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#101612' },
  flex: { flex: 1 },
  header: { height: 76, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#273128', backgroundColor: '#121A15' },
  brand: { color: '#F1E7D0', fontWeight: '900', fontSize: 24, letterSpacing: 2.5 },
  byline: { color: '#A7B09F', fontSize: 12, letterSpacing: 1.2 },
  livePill: { borderWidth: 1, borderColor: '#536653', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  liveText: { color: '#C5D2BE', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  content: { flex: 1 },
  page: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionTitle: { color: '#F1E7D0', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  card: { backgroundColor: '#182119', borderWidth: 1, borderColor: '#2B372D', borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { color: '#F0E7D5', fontSize: 18, fontWeight: '800' },
  muted: { color: '#A5AEA3', lineHeight: 20 },
  mapHint: { position: 'absolute', left: 14, right: 14, bottom: 16, backgroundColor: 'rgba(16,22,18,0.92)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#344136' },
  mapHintTitle: { color: '#F1E7D0', fontWeight: '800', marginBottom: 3 },
  chips: { maxHeight: 48, marginBottom: 2 },
  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#202A22', borderWidth: 1, borderColor: '#344137' },
  chipActive: { borderColor: '#D78B2D', backgroundColor: '#302519' },
  chipText: { color: '#F1E7D0', fontWeight: '700' },
  coordinate: { color: '#879186', fontSize: 12 },
  primaryButton: { backgroundColor: '#D78B2D', paddingVertical: 13, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#15120D', fontWeight: '900', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', minHeight: 110, backgroundColor: '#182119', borderWidth: 1, borderColor: '#2B372D', borderRadius: 15, padding: 14, justifyContent: 'center' },
  metricLabel: { color: '#8D978D', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  metricValue: { color: '#F1E7D0', fontSize: 25, fontWeight: '900', marginTop: 6 },
  input: { backgroundColor: '#111713', borderWidth: 1, borderColor: '#334037', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 12, color: '#F1E7D0' },
  notes: { minHeight: 88, textAlignVertical: 'top' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { color: '#D78B2D', fontWeight: '900', fontSize: 22 },
  reportSpecies: { color: '#C8D2C4', fontWeight: '700' },
  timestamp: { color: '#687268', fontSize: 11, marginTop: 4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: '48%', aspectRatio: 1.15, borderRadius: 12, backgroundColor: '#1B241D' },
  tabs: { height: 64, flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#283229', backgroundColor: '#121A15' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#778177', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#D78B2D' },
});
