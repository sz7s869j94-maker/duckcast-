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
import MapView, { Geojson, Marker, Region, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// DuckCast live preview: private by default, shared only through accepted email links.

type Tab = 'Map' | 'Weather' | 'Reports' | 'Journal' | 'Profile';
type WaypointType = 'Hunt Spot' | 'Camera' | 'Blind' | 'Food Plot' | 'Access';
type Waypoint = { id: string; name: string; latitude: number; longitude: number; private: boolean; type: WaypointType; color: string };
type Report = { id: string; ownerId: string; location: string; birds: string; species: string; notes: string; createdAt: string; shared: boolean };
type HuntEntry = { id: string; ownerId: string; location: string; birds: string; notes: string; createdAt: string; shared: boolean };
type RadarFrame = { url: string; time: string };
type LandLabel = { id: string; name: string; latitude: number; longitude: number; kind: 'public' | 'parcel' };
type WindReading = { speed: number; direction: number };
type LinkedHunter = { id: string; email: string; display_name: string | null };
type Invitation = { id: string; inviter_id: string; invitee_email: string; status: string };
type Camera = { id: string; name: string; sharing_enabled: boolean; owner_id: string };
type Weather = {
  temperature: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  rain7d: number;
  humidity: number;
  condition: string;
  updatedAt: string;
  hourly: { time: string; temp: number; wind: number; precipChance: number }[];
  daily: { date: string; high: number; low: number; rainChance: number; rain: number; wind: number }[];
};

const ORANGE = '#EF7C22';
const WAYPOINT_ICONS: Record<WaypointType, string> = {
  'Hunt Spot': '🦆',
  Camera: '▣',
  Blind: '⌂',
  'Food Plot': '♣',
  Access: '↗',
};
const DUCK_LOGO_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAMAAADVRocKAAAAflBMVEX////ueCDudyDudiDtdiHtdSDudyHueCHveCHudiHueCLueSLtdiDtdyHteCHteCLveCLveSLveSHueSHvdyDweCHvdyHueiPveiPueSPveSPvdiDveiLvdiHudyLueCPtdyLtdh/weiPweSHueB/sdh7ueiLweiLweSLtdyCX3lX7AAAAAXRSTlMAQObYZgAABJtJREFUaN7tWG1z2zYMduWMYMBKJuTMFjktbZOtaf//HxxeSLu73Tl2TH3YnXC9VlWc5yGABy/0ZrPaaqutttpqTexTt314WA7+NwfeOQC3DLx7fAQAxBDQLUHxuXdugKC2iBMSGhgEXBgcNsdHHBygECCItT9/wB41PIWiLUHPh0dxQLAHbJ8FxUbNMA69uNCWQNWD9gcHzUFbhiJPRudIoZYDoG9I0BnDTsBRLUCIDX3wQBr9IRQCIqbkxtGOQKOPrFXJNYAnCxlRG4KRcXcion2g6P3Tk/ckFMR9ads1ILDAQCC2sZLuR+GAzvUNGHpQ8TDDr9qBT967roUH0ioYHoD2LcX5i6E2UWQC+H0ZBtgTaY/zh6dlCLiwNA+soUUISHsp53j0sEwaCMPxyCoVwS7CwLUWpmQT2Y/34/3XcqA68gHvb0LbrnM+EsXou8MfGiO2MtXwToKnw8GJ8OeZMSOPFvcnKweFwfNqEe7bjIjxnJPWkyeyUyM3ONeDsPFPQafBRxlcBzawMCh01jlAM6FOZBkC0vWE4UOn54BIw1c0IUiCLmQyB4JmQIamOPZ8O3xECiTnTLpApBxsEe17S6xR2/QP4cutDBx2KnM9pbKjaLThDK0aCuXp603wW87rGRRrnIQUh0pAuLPFBW9U6uh06yQLxAldIyXSr3n5F3e4ev3dys6PoRDYASXOSSIV0olxp8AyF1Dnc7wE+q0G3ovoActWGMo/9UlSnYxUhj4auUqWLnvQP3T+hatSA4/g7FcqvtGJA+lEgLJ16euiBLroweazI5q40ZCosRRWRTWelJOhlRAp7aSvku1IlyPP2CStQD+tq6ZQWNz5TdKnNOm6WKLPA2GicwzfTTK9evlgzpUAKFd8LuHEJNkIinpLeZcIXrHSvRJLgiFPOiwOYMluCkIQTgoA1ZRgo4yeC8h/dd2B+yO3NSla5KtRxdCgD9oo1BeCcnJ5IW3kqymOpnDx7NKOSdNmXQGwHFnd351iUm4cSn0Mp+qWmn4nxVU1AhmqvtUbk0s6F0OueS2fkjxz030v/r26mvEkCYtJqmUwTVMKZ8WUzMjvzNOUc3wPX2z09DJLGRgka8aipJFShYYqqvIJ9YW1fLz2UjByKfB5JAyYLJEmpWTPlYAdg2HQn0yzsFyF/neHXGzs8Jy5QMuMNJajAe9EY2SJ0uWafch8mN2V59/wmjnytC1tuhSRFXGyhPN/s/Fap9CX18KXIM0br3s52BA2Ge0KFr/jQue/zLfvHKCb4KtZOy7zgGrVJdJOSJootiNH80PwYs+YUHcFFaRI6QtXK4VjyiR5mpjkmu5zyRBszQqhZIBLauZ+m7O+f7sP3Qwgap8RsX6fOPJMgBgbXYXP9kJasD/k1IDLrOoiKXvy/nUJgk2o9yRaIESKG+s1iRmWINj7eh0el/HAb+tldYyLMDh3KE9vcREGnsvRnmbenqK0xab4Px0+u5JmvnpHvjvx5al/dM2KQr9dqSXwyk1datq1/FKc+/eeT+3tG9436VIZmnz1VG0I0or4zuZ96++pq8ko8H6ZLyZWW2211f6/9g8kVGkZ3tRsggAAAABJRU5ErkJggg==';
const DEFAULT_REGION: Region = {
  latitude: 44.50,
  longitude: -89.50,
  latitudeDelta: 0.18,
  longitudeDelta: 0.18,
};

const STATE_CODES: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

const STATE_LAND_SOURCES: Record<string, { name: string; publicDetail: string; parcels?: string }> = Object.fromEntries(
  Object.entries(STATE_CODES).map(([name, code]) => [code, { name, publicDetail: 'USGS PAD-US + federal, state, local and nonprofit lands' }])
);
STATE_LAND_SOURCES.WI = { name: 'Wisconsin', publicDetail: 'PAD-US + Wisconsin public-access and MFL coverage', parcels: 'Wisconsin Statewide Parcel Map' };
STATE_LAND_SOURCES.AR = { name: 'Arkansas', publicDetail: 'PAD-US + Arkansas Game & Fish WMA boundaries' };

const samplePhotos = [
  'https://images.unsplash.com/photo-1473445361085-b9a07f55608b?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1500463959177-e0869687df26?auto=format&fit=crop&w=700&q=80',
  'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=700&q=80',
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
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
  const [reportSpecies, setReportSpecies] = useState('Waterfowl');
  const [reportWaypointId, setReportWaypointId] = useState('');
  const [mapType, setMapType] = useState<'hybrid' | 'satellite'>('hybrid');
  const [editing, setEditing] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [journalCount, setJournalCount] = useState(0);
  const [journalEntries, setJournalEntries] = useState<HuntEntry[]>([]);
  const [journalForm, setJournalForm] = useState(false);
  const [journalLocation, setJournalLocation] = useState('');
  const [journalBirds, setJournalBirds] = useState('');
  const [journalNotes, setJournalNotes] = useState('');
  const [journalWaypointId, setJournalWaypointId] = useState('');
  const [mapControls, setMapControls] = useState(false);
  const [showMapTip, setShowMapTip] = useState(false);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showRadar, setShowRadar] = useState(false);
  const [showWind, setShowWind] = useState(false);
  const [showPublicLands, setShowPublicLands] = useState(false);
  const [showBoundaries, setShowBoundaries] = useState(false);
  const [activeState, setActiveState] = useState('WI');
  const [publicLandGeojson, setPublicLandGeojson] = useState<Record<string, any>>({});
  const [parcelGeojson, setParcelGeojson] = useState<any>({ type: 'FeatureCollection', features: [] });
  const [landLabels, setLandLabels] = useState<LandLabel[]>([]);
  const [radarUrl, setRadarUrl] = useState('');
  const [radarTime, setRadarTime] = useState('');
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarFrameIndex, setRadarFrameIndex] = useState(0);
  const [waypointWind, setWaypointWind] = useState<Record<string, WindReading>>({});
  const [forecastRange, setForecastRange] = useState<'Hourly' | '24 Hours' | '72 Hours' | '7-Day'>('Hourly');
  const [draftType, setDraftType] = useState<WaypointType>('Hunt Spot');
  const [draftColor, setDraftColor] = useState(ORANGE);
  const [linkedHunters, setLinkedHunters] = useState<LinkedHunter[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [cameraName, setCameraName] = useState('');
  const [waypointGrants, setWaypointGrants] = useState<Record<string, string[]>>({});
  const [cameraGrants, setCameraGrants] = useState<Record<string, string[]>>({});

  const selected = useMemo(
    () => waypoints.find((point) => point.id === selectedId),
    [waypoints, selectedId]
  );

  useEffect(() => {
    void locateUser();
    AsyncStorage.getItem('duckcast-map-tip-seen').then((seen) => setShowMapTip(seen !== '1'));
  }, []);

  function dismissMapTip() {
    setShowMapTip(false);
    void AsyncStorage.setItem('duckcast-map-tip-seen', '1');
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void loadCloudData();
  }, [session?.user.id]);

  async function loadCloudData() {
    const [wp, reportRows, journalRows, profileRows, inviteRows, cameraRows, wpGrantRows, cameraGrantRows] = await Promise.all([
      supabase.from('waypoints').select('*').order('created_at'),
      supabase.from('field_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('journal_entries').select('*').order('hunted_at', { ascending: false }),
      supabase.from('profiles').select('id,email,display_name'),
      supabase.from('account_invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('cameras').select('*').order('created_at'),
      supabase.from('waypoint_grants').select('waypoint_id,viewer_id'),
      supabase.from('camera_grants').select('camera_id,viewer_id'),
    ]);
    if (wp.data) setWaypoints(wp.data.map((row) => ({ id: row.id, name: row.name, latitude: row.latitude, longitude: row.longitude, private: row.visibility === 'private', type: row.waypoint_type as WaypointType, color: row.color })));
    if (reportRows.data) setReports(reportRows.data.map((row) => ({ id: row.id, ownerId: row.owner_id, location: row.location, birds: String(row.bird_count), species: row.species, notes: row.notes ?? '', createdAt: new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }), shared: row.visibility === 'linked' })));
    if (journalRows.data) { setJournalEntries(journalRows.data.map((row) => ({ id: row.id, ownerId: row.owner_id, location: row.location, birds: String(row.birds_seen), notes: row.notes ?? '', createdAt: new Date(row.hunted_at).toLocaleDateString([], { month: 'short', day: 'numeric' }), shared: row.visibility === 'linked' }))); setJournalCount(journalRows.data.length); }
    if (profileRows.data) setLinkedHunters(profileRows.data.filter((row) => row.id !== session?.user.id));
    if (inviteRows.data) setInvitations(inviteRows.data);
    if (cameraRows.data) setCameras(cameraRows.data);
    if (wpGrantRows.data) setWaypointGrants(groupGrants(wpGrantRows.data, 'waypoint_id'));
    if (cameraGrantRows.data) setCameraGrants(groupGrants(cameraGrantRows.data, 'camera_id'));
  }

  useEffect(() => {
    if (selected) void refreshWeather(selected);
  }, [selectedId]);

  useEffect(() => {
    if (!showRadar) return;
    void refreshRadar();
    const timer = setInterval(() => void refreshRadar(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [showRadar]);

  useEffect(() => {
    if (!showRadar || !radarFrames.length) return;
    const showFrame = (index: number) => {
      const frame = radarFrames[index];
      if (!frame) return;
      setRadarUrl(frame.url);
      setRadarTime(frame.time);
    };
    showFrame(radarFrameIndex % radarFrames.length);
    const animator = setInterval(() => {
      setRadarFrameIndex((current) => {
        const next = (current + 1) % radarFrames.length;
        showFrame(next);
        return next;
      });
    }, 900);
    return () => clearInterval(animator);
  }, [showRadar, radarFrames]);

  useEffect(() => {
    if (showWind && waypoints.length) void refreshWaypointWind();
  }, [showWind, waypoints.length]);

  useEffect(() => {
    if (!showPublicLands && !showBoundaries) return;
    const timer = setTimeout(() => void refreshLandLayers(), 700);
    return () => clearTimeout(timer);
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta, showPublicLands, showBoundaries, activeState]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const places = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
        const state = places[0]?.region;
        if (state) setActiveState(STATE_CODES[state] ?? state.toUpperCase().slice(0, 2));
      } catch { /* Keep the last confirmed state when reverse geocoding is unavailable. */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [region.latitude, region.longitude]);

  async function refreshLandLayers() {
    const withinBoundaryScale = region.latitudeDelta * 69 <= 5;
    if (!withinBoundaryScale) {
      setParcelGeojson({ type: 'FeatureCollection', features: [] });
      setPublicLandGeojson({});
      setLandLabels([]);
      return;
    }
    const west = region.longitude - region.longitudeDelta / 2;
    const east = region.longitude + region.longitudeDelta / 2;
    const south = region.latitude - region.latitudeDelta / 2;
    const north = region.latitude + region.latitudeDelta / 2;
    const geometryQuery = `geometry=${encodeURIComponent(`${west},${south},${east},${north}`)}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&f=geojson&resultRecordCount=2000`;
    const nextLabels: LandLabel[] = [];
    try {
      if (showPublicLands) {
        const response = await fetch(`https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/PADUS_Public_Access/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,Unit_Nm,Pub_Access,MngNm_Desc,DesTp_Desc&${geometryQuery}`);
        const data = response.ok ? await response.json() : { features: [] };
        const buckets: Record<string, any[]> = { Open: [], Restricted: [], Closed: [], Unknown: [] };
        for (const feature of data.features ?? []) {
          const access = String(feature.properties?.Pub_Access ?? 'Unknown');
          const bucket = access.startsWith('Open') ? 'Open' : access.startsWith('Restricted') ? 'Restricted' : access.startsWith('Closed') ? 'Closed' : 'Unknown';
          buckets[bucket]!.push(feature);
          const center = featureCenter(feature.geometry);
          const name = feature.properties?.Unit_Nm || feature.properties?.MngNm_Desc || feature.properties?.DesTp_Desc;
          if (center && name && nextLabels.length < 35 && !nextLabels.some((label) => label.name === name)) nextLabels.push({ id: `public-${feature.id ?? nextLabels.length}`, name, ...center, kind: 'public' });
        }
        if (activeState === 'AR') {
          const arResponse = await fetch(`https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Boundaries/FeatureServer/37/query?where=1%3D1&outFields=objectid,fname,flabel,wma&${geometryQuery}`);
          const arData = arResponse.ok ? await arResponse.json() : { features: [] };
          for (const feature of arData.features ?? []) {
            buckets.Open!.push(feature);
            const center = featureCenter(feature.geometry);
            const name = feature.properties?.fname || feature.properties?.flabel || feature.properties?.wma;
            if (center && name && nextLabels.length < 35 && !nextLabels.some((label) => label.name === name)) nextLabels.push({ id: `ar-wma-${feature.id ?? nextLabels.length}`, name, ...center, kind: 'public' });
          }
        }
        setPublicLandGeojson(Object.fromEntries(Object.entries(buckets).map(([key, features]) => [key, { type: 'FeatureCollection', features }])));
      } else setPublicLandGeojson({});
      if (showBoundaries && activeState === 'WI') {
        const response = await fetch(`https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/EN_County_Tax_Parcels_WTM_Ext_Dynamic_L16/MapServer/0/query?where=1%3D1&outFields=OBJECTID,PARCELID,TAXPARCELID,OWNERNME1,OWNERNME2,SITEADRESS,PLACENAME,CONAME,DEEDACRES,GISACRES,PROPCLASS,TAXROLLYEAR&${geometryQuery}`);
        const data = response.ok ? await response.json() : { features: [] };
        setParcelGeojson({ type: 'FeatureCollection', features: data.features ?? [] });
        for (const feature of (data.features ?? []).slice(0, 80)) {
          const center = featureCenter(feature.geometry);
          const owner = [feature.properties?.OWNERNME1, feature.properties?.OWNERNME2].filter(Boolean).join(' ');
          if (center && owner) nextLabels.push({ id: `parcel-${feature.id}`, name: owner, ...center, kind: 'parcel' });
        }
      } else setParcelGeojson({ type: 'FeatureCollection', features: [] });
      setLandLabels(nextLabels);
    } catch {
      Alert.alert('Land layers', 'Land boundary data could not be loaded for this map area.');
    }
  }

  async function refreshRadar() {
    try {
      const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!response.ok) throw new Error('Radar unavailable');
      const data = await response.json();
      const frames = data.radar?.past ?? [];
      const latest = frames[frames.length - 1];
      if (!latest?.path || !data.host) throw new Error('No radar frame');
      const cutoff = Number(latest.time) - (30 * 60);
      const rollingFrames: RadarFrame[] = frames
        .filter((frame: { time: number }) => Number(frame.time) >= cutoff)
        .map((frame: { path: string; time: number }) => ({
          url: `${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
          time: new Date(Number(frame.time) * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        }));
      if (!rollingFrames.length) throw new Error('No rolling radar frames');
      const firstFrame = rollingFrames[0];
      if (!firstFrame) throw new Error('No rolling radar frames');
      setRadarFrames(rollingFrames);
      setRadarFrameIndex(0);
      setRadarUrl(firstFrame.url);
      setRadarTime(firstFrame.time);
    } catch {
      setShowRadar(false);
      Alert.alert('Precipitation radar', 'The live radar layer could not be loaded.');
    }
  }

  function showParcelDetails(overlay: any) {
    const details = overlay?.feature?.properties ?? {};
    const owner = [details.OWNERNME1, details.OWNERNME2].filter(Boolean).join(' ') || 'Not published';
    const parcelId = details.PARCELID || details.TAXPARCELID || 'Not published';
    const acres = details.DEEDACRES || details.GISACRES;
    const rows = [
      `Owner: ${owner}`,
      `Parcel: ${parcelId}`,
      details.SITEADRESS && `Site: ${details.SITEADRESS}`,
      details.CONAME && `County: ${details.CONAME}`,
      acres && `Acres: ${Number(acres).toFixed(2)}`,
      details.PROPCLASS && `Property class: ${details.PROPCLASS}`,
      details.TAXROLLYEAR && `Tax roll: ${details.TAXROLLYEAR}`,
    ].filter(Boolean);
    Alert.alert('Parcel Information', rows.join('\n'));
  }

  async function refreshWaypointWind() {
    const readings = await Promise.all(waypoints.map(async (point) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${point.latitude}&longitude=${point.longitude}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`);
        const data = await response.json();
        return [point.id, { speed: Number(data.current?.wind_speed_10m ?? 0), direction: Number(data.current?.wind_direction_10m ?? 0) }] as const;
      } catch { return [point.id, { speed: 0, direction: 0 }] as const; }
    }));
    setWaypointWind(Object.fromEntries(readings));
  }

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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${target.latitude}&longitude=${target.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,wind_speed_10m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,rain_sum,wind_speed_10m_max&past_days=7&forecast_days=7&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather service unavailable');
      const data = await response.json();
      const rain = (data.daily?.rain_sum ?? []) as number[];
      const codes: Record<number, string> = { 0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Cloudy', 45: 'Fog', 51: 'Drizzle', 61: 'Rain', 71: 'Snow', 80: 'Rain Showers', 95: 'Thunderstorms' };
      const times = (data.hourly?.time ?? []) as string[];
      const temps = (data.hourly?.temperature_2m ?? []) as number[];
      const winds = (data.hourly?.wind_speed_10m ?? []) as number[];
      const precip = (data.hourly?.precipitation_probability ?? []) as number[];
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
        hourly: times.slice(nowIndex, nowIndex + 72).map((time, index) => ({
          time: new Date(time).toLocaleTimeString([], { hour: 'numeric' }),
          temp: Number(temps[nowIndex + index] ?? 0),
          wind: Number(winds[nowIndex + index] ?? 0),
          precipChance: Number(precip[nowIndex + index] ?? 0),
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
    const importedUri = result.canceled ? undefined : result.assets[0]?.uri;
    if (importedUri) {
      setPhotos((current) => [importedUri, ...current]);
    }
  }

  async function saveWaypointName() {
    const name = draftName.trim();
    if (!name || !selected) return;
    const updated = { ...selected, name, type: draftType, color: draftColor };
    setWaypoints((current) => current.map((point) => point.id === selected.id ? updated : point));
    setEditing(false);
    setWeather(null);
    void refreshWeather(updated);
    if (session) {
      const payload = { owner_id: session.user.id, name, waypoint_type: draftType, latitude: selected.latitude, longitude: selected.longitude, color: draftColor, visibility: selected.private ? 'private' : 'linked', updated_at: new Date().toISOString() };
      if (selected.id.length > 20) await supabase.from('waypoints').update(payload).eq('id', selected.id);
      else {
        const { data } = await supabase.from('waypoints').insert(payload).select('id').single();
        if (data) setSelectedId(data.id);
      }
      void loadCloudData();
    }
  }

  function deleteWaypoint() {
    if (!selected) return;
    const remaining = waypoints.filter((point) => point.id !== selected.id);
    setWaypoints(remaining);
    setSelectedId(remaining[0]?.id ?? '');
    setWeather(null);
    setEditing(false);
    if (selected.id.length > 20) void supabase.from('waypoints').delete().eq('id', selected.id);
  }

  function confirmDeleteWaypoint() {
    if (!selected) return;
    setMoreMenu(false);
    Alert.alert('Delete waypoint?', `${selected.name} will be removed from your map.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: deleteWaypoint },
    ]);
  }

  function closeWaypointDetail() {
    setSelectedId('');
    setWeather(null);
  }

  function centerSelectedWaypoint() {
    if (!selected) return;
    const nextRegion = { ...region, latitude: selected.latitude, longitude: selected.longitude };
    setMoreMenu(false);
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 500);
  }

  function togglePrivacy() {
    if (!selected) return;
    setWaypoints((current) => current.map((point) =>
      point.id === selected.id ? { ...point, private: !point.private } : point
    ));
    if (selected.id.length > 20) void supabase.from('waypoints').update({ visibility: selected.private ? 'linked' : 'private' }).eq('id', selected.id);
  }

  function logHunt() {
    if (!journalLocation.trim()) { Alert.alert('Choose a hunt location'); return; }
    const entry = { id: String(Date.now()), ownerId: session?.user.id ?? '', location: journalLocation.trim(), birds: journalBirds.trim() || '0', notes: journalNotes.trim(), createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }), shared: false };
    setJournalEntries((current) => [entry, ...current]);
    setJournalCount((count) => count + 1);
    setJournalLocation(''); setJournalBirds(''); setJournalNotes(''); setJournalWaypointId(''); setJournalForm(false);
    if (session) void supabase.from('journal_entries').insert({ owner_id: session.user.id, waypoint_id: journalWaypointId || null, location: entry.location, birds_seen: Number(entry.birds), notes: entry.notes, visibility: 'private' }).then(() => loadCloudData());
  }

  function publishReport() {
    if (!reportLocation.trim() || !reportBirds.trim()) {
      Alert.alert('Add a location and bird count');
      return;
    }
    setReports((current) => [{
      id: String(Date.now()),
      ownerId: session?.user.id ?? '',
      location: reportLocation.trim(),
      birds: reportBirds.trim(),
      species: reportSpecies,
      notes: reportNotes.trim(),
      createdAt: new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
      shared: false,
    }, ...current]);
    setReportBirds('');
    setReportNotes('');
    setReportWaypointId('');
    if (session) void supabase.from('field_reports').insert({ owner_id: session.user.id, location: reportLocation.trim(), bird_count: Number(reportBirds), species: reportSpecies, notes: reportNotes.trim(), visibility: 'private' }).then(() => loadCloudData());
  }

  async function toggleEntrySharing(kind: 'report' | 'journal', id: string, shared: boolean) {
    if (!session || id.length < 20) return;
    const table = kind === 'report' ? 'field_reports' : 'journal_entries';
    const { error } = await supabase.from(table).update({ visibility: shared ? 'private' : 'linked' }).eq('id', id).eq('owner_id', session.user.id);
    if (error) Alert.alert('Sharing', error.message);
    else {
      if (kind === 'report') setReports((current) => current.map((item) => item.id === id ? { ...item, shared: !shared } : item));
      else setJournalEntries((current) => current.map((item) => item.id === id ? { ...item, shared: !shared } : item));
    }
  }

  async function sendInvitation() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !session) return;
    const { error } = await supabase.from('account_invitations').insert({ inviter_id: session.user.id, invitee_email: email });
    if (error) Alert.alert('Account link', error.message);
    else { setInviteEmail(''); Alert.alert('Invitation created', `When ${email} creates or signs into DuckCast, they can accept your link request.`); void loadCloudData(); }
  }

  async function respondToInvitation(id: string, status: 'accepted' | 'declined') {
    const { error } = await supabase.from('account_invitations').update({ status }).eq('id', id);
    if (error) Alert.alert('Account link', error.message); else void loadCloudData();
  }

  async function addCamera() {
    if (!cameraName.trim() || !session) return;
    const { error } = await supabase.from('cameras').insert({ owner_id: session.user.id, name: cameraName.trim(), provider: 'tactacam' });
    if (error) Alert.alert('Camera', error.message); else { setCameraName(''); void loadCloudData(); }
  }

  async function toggleGrant(kind: 'waypoint' | 'camera', itemId: string, viewerId: string) {
    if (!session) return;
    const table = kind === 'waypoint' ? 'waypoint_grants' : 'camera_grants';
    const idColumn = kind === 'waypoint' ? 'waypoint_id' : 'camera_id';
    const current = kind === 'waypoint' ? waypointGrants[itemId] ?? [] : cameraGrants[itemId] ?? [];
    if (current.includes(viewerId)) await supabase.from(table).delete().eq(idColumn, itemId).eq('viewer_id', viewerId);
    else await supabase.from(table).insert({ [idColumn]: itemId, viewer_id: viewerId, granted_by: session.user.id });
    if (kind === 'waypoint') await supabase.from('waypoints').update({ visibility: 'linked' }).eq('id', itemId);
    else await supabase.from('cameras').update({ sharing_enabled: true }).eq('id', itemId);
    void loadCloudData();
  }

  if (!authReady) return <SafeAreaView style={styles.safe}><BrandHeader /><View style={styles.authLoading}><Text style={styles.weatherTitle}>Opening DuckCast…</Text></View></SafeAreaView>;
  if (!session) return <AuthScreen />;

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
                {showPublicLands && <LandLayers data={publicLandGeojson} />}
                {showBoundaries && <Geojson geojson={parcelGeojson} fillColor="rgba(255,235,175,0.02)" strokeColor="rgba(255,235,175,0.88)" strokeWidth={0.8} tappable onPress={showParcelDetails} />}
                <LandLabels labels={landLabels.filter((label) => label.kind === 'public' ? showPublicLands : showBoundaries)} />
                {showRadar && !!radarUrl && <UrlTile key={radarUrl} urlTemplate={radarUrl} maximumZ={20} maximumNativeZ={7} opacity={0.68} zIndex={2} tileSize={256} />}
                {showWaypoints && waypoints.map((point) => (
                  <WindMarker key={point.id} point={point} wind={waypointWind[point.id]} showWind={showWind} showLabel={selectedId === point.id} onPress={() => { setSelectedId(point.id); setWeather(null); void refreshWeather(point); }} onMove={(latitude, longitude) => moveWaypoint(point, latitude, longitude)} />
                ))}
              </MapView>
              <View style={styles.mapTopRow}>
                <Pressable
                  style={styles.glassButton}
                  onPress={closeWaypointDetail}
                >
                  <Text style={styles.fullMapText}>‹ Full Map</Text>
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
              <View style={styles.scale}><Text style={styles.scaleText}>0      500      1,000 ft</Text></View>
              <Pressable style={styles.privatePill} onPress={togglePrivacy}>
                <Text style={styles.privateText}>▣  {selected.private ? 'Private' : 'Shared'}</Text>
              </Pressable>
              {showRadar && <View style={styles.radarLegend}><Text style={styles.radarLegendTitle}>PRECIP RADAR · {radarTime || 'LOADING'}</Text><View style={styles.radarColors}><View style={[styles.radarColor, { backgroundColor: '#4BB85B' }]} /><View style={[styles.radarColor, { backgroundColor: '#F2D14D' }]} /><View style={[styles.radarColor, { backgroundColor: '#E64232' }]} /></View></View>}
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
              <Pressable style={styles.moreButton} onPress={() => setMoreMenu(true)}>
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
            >
              {showPublicLands && <LandLayers data={publicLandGeojson} />}
              {showBoundaries && <Geojson geojson={parcelGeojson} fillColor="rgba(255,235,175,0.02)" strokeColor="rgba(255,235,175,0.88)" strokeWidth={0.8} tappable onPress={showParcelDetails} />}
              <LandLabels labels={landLabels.filter((label) => label.kind === 'public' ? showPublicLands : showBoundaries)} />
              {showRadar && !!radarUrl && <UrlTile key={radarUrl} urlTemplate={radarUrl} maximumZ={20} maximumNativeZ={7} opacity={0.68} zIndex={2} tileSize={256} />}
              {showWaypoints && waypoints.map((point) => (
                <WindMarker key={point.id} point={point} wind={waypointWind[point.id]} showWind={showWind} showLabel={selectedId === point.id} onPress={() => { setSelectedId(point.id); setWeather(null); void refreshWeather(point); }} onMove={(latitude, longitude) => moveWaypoint(point, latitude, longitude)} />
              ))}
            </MapView>
            <View style={styles.emptyMapTools}>
              <Pressable style={[styles.squareButton, styles.actionButton]} onPress={() => setMapControls(true)}>
                <Text style={styles.toolIcon}>☰</Text>
              </Pressable>
              <Pressable style={styles.squareButton} onPress={locateUser}><Text style={styles.toolIcon}>➤</Text></Pressable>
            </View>
            {showMapTip && <View style={styles.cleanSlateCard}>
              <Pressable style={styles.tipClose} onPress={dismissMapTip}><Text style={styles.tipCloseText}>×</Text></Pressable>
              <Text style={styles.cleanSlateTitle}>Build your DuckCast map</Text>
              <Text style={styles.cleanSlateText}>Pan and zoom anywhere. Long-press the map to create your first waypoint and load live weather for that exact spot.</Text>
            </View>}
            {showRadar && <View style={styles.fullRadarLegend}><Text style={styles.radarLegendTitle}>PRECIP RADAR · {radarTime || 'LOADING'}</Text><View style={styles.radarColors}><View style={[styles.radarColor, { backgroundColor: '#4BB85B' }]} /><View style={[styles.radarColor, { backgroundColor: '#F2D14D' }]} /><View style={[styles.radarColor, { backgroundColor: '#E64232' }]} /></View></View>}
          </View>
        ))}

        {tab === 'Weather' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.eyebrow}>LIVE CONDITIONS</Text>
            <Text style={styles.pageTitle}>Marsh Weather</Text>
            <WeatherPanel weather={weather} loading={weatherLoading} onRefresh={() => refreshWeather()} />
            <View style={styles.forecastTabs}>
              {(['Hourly', '24 Hours', '72 Hours', '7-Day'] as const).map((range) => (
                <Pressable key={range} style={[styles.forecastTab, forecastRange === range && styles.forecastTabActive]} onPress={() => setForecastRange(range)}>
                  <Text style={[styles.forecastTabText, forecastRange === range && styles.forecastTabTextActive]}>{range}</Text>
                </Pressable>
              ))}
            </View>
            {weather && forecastRange !== '7-Day' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.largeForecastRail}>
                {weather.hourly.slice(0, forecastRange === 'Hourly' ? 12 : forecastRange === '24 Hours' ? 24 : 72).map((hour, index) => (
                  <View style={styles.largeHourCard} key={`${hour.time}-${index}`}>
                    <Text style={styles.hourTime}>{hour.time}</Text>
                    <Text style={styles.largeHourTemp}>{hour.temp.toFixed(0)}°</Text>
                    <Text style={styles.hourRain}>● {hour.precipChance.toFixed(0)}%</Text>
                    <Text style={styles.hourWind}>➤ {hour.wind.toFixed(0)} mph</Text>
                  </View>
                ))}
              </ScrollView>
            )}
            {weather && forecastRange === '7-Day' && (
              <View style={styles.dailyForecast}>
                {weather.daily.slice(0, 7).map((day) => (
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
                  <Text style={styles.rowValue}>{selected?.id === point.id && weather ? `${weather.windSpeed.toFixed(0)} mph` : 'View'}  ›</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        {tab === 'Reports' && (
          <ScrollView contentContainerStyle={styles.page}>
            <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>COMMUNITY FIELD INTEL</Text><Text style={styles.pageTitle}>Reports</Text></View><View style={styles.countPill}><Text style={styles.countPillNumber}>{reports.length}</Text><Text style={styles.countPillLabel}>POSTED</Text></View></View>
            <View style={styles.composerCard}>
              <Text style={styles.panelTitle}>Share a field report</Text>
              <TextInput style={styles.input} placeholder="Type a location or select a waypoint" placeholderTextColor="#778079" value={reportLocation} onChangeText={(value) => { setReportLocation(value); setReportWaypointId(''); }} />
              {!!waypoints.length && <><Text style={styles.pickerLabel}>OR SELECT A WAYPOINT</Text><WaypointDropdown waypoints={waypoints} selectedId={reportWaypointId} onSelect={(point) => { setReportWaypointId(point.id); setReportLocation(point.name); }} /></>}
              <View style={styles.inlineInputs}><TextInput style={[styles.input, styles.flex]} placeholder="Bird count" placeholderTextColor="#778079" keyboardType="number-pad" value={reportBirds} onChangeText={setReportBirds} /><TextInput style={[styles.input, styles.flex]} placeholder="Species" placeholderTextColor="#778079" value={reportSpecies} onChangeText={setReportSpecies} /></View>
              <TextInput style={[styles.input, styles.notes]} placeholder="Migration, pressure, species and notes…" placeholderTextColor="#778079" multiline value={reportNotes} onChangeText={setReportNotes} />
              <Pressable style={styles.primaryButton} onPress={publishReport}><Text style={styles.primaryButtonText}>Publish Report</Text></Pressable>
            </View>
            {!reports.length && <View style={styles.emptyState}><Text style={styles.emptyStateIcon}>◉</Text><Text style={styles.panelTitle}>No reports yet</Text><Text style={styles.subtle}>Post the first field report for your area.</Text></View>}
            {reports.map((report) => (
              <View style={styles.reportCard} key={report.id}>
                <View style={styles.reportTop}><View><Text style={styles.panelTitle}>{report.location}</Text><Text style={styles.reportDate}>{report.createdAt} · {report.species}</Text></View><View style={styles.birdCountBadge}><Text style={styles.reportCount}>{report.birds}</Text><Text style={styles.birdCountLabel}>BIRDS</Text></View></View>
                <Text style={styles.subtle}>{report.notes || 'No additional field notes.'}</Text>
                {report.ownerId === session.user.id
                  ? <ShareToggle shared={report.shared} onPress={() => toggleEntrySharing('report', report.id, report.shared)} />
                  : <Text style={styles.sharedByLabel}>SHARED BY A LINKED HUNTER</Text>}
              </View>
            ))}
          </ScrollView>
        )}

        {tab === 'Journal' && (
          <ScrollView contentContainerStyle={styles.page}>
            <View style={styles.sectionHeading}><View><Text style={styles.eyebrow}>YOUR SEASON</Text><Text style={styles.pageTitle}>Journal</Text></View><Pressable style={styles.addHuntButton} onPress={() => setJournalForm((value) => !value)}><Text style={styles.primaryButtonText}>{journalForm ? 'Close' : '＋ Log Hunt'}</Text></Pressable></View>
            <View style={styles.seasonStats}><View style={styles.statBlock}><Text style={styles.statNumber}>{journalCount}</Text><Text style={styles.statLabel}>HUNTS</Text></View><View style={styles.statDivider} /><View style={styles.statBlock}><Text style={styles.statNumber}>{journalEntries.reduce((sum, entry) => sum + Number(entry.birds || 0), 0)}</Text><Text style={styles.statLabel}>BIRDS SEEN</Text></View><View style={styles.statDivider} /><View style={styles.statBlock}><Text style={styles.statNumber}>{waypoints.length}</Text><Text style={styles.statLabel}>SPOTS</Text></View></View>
            {journalForm && <View style={styles.composerCard}><Text style={styles.panelTitle}>New hunt entry</Text><TextInput style={styles.input} placeholder="Type a location or select a waypoint" placeholderTextColor="#778079" value={journalLocation} onChangeText={(value) => { setJournalLocation(value); setJournalWaypointId(''); }} />{!!waypoints.length && <><Text style={styles.pickerLabel}>OR SELECT A WAYPOINT</Text><WaypointDropdown waypoints={waypoints} selectedId={journalWaypointId} onSelect={(point) => { setJournalWaypointId(point.id); setJournalLocation(point.name); }} /></>}<TextInput style={styles.input} placeholder="Birds seen" placeholderTextColor="#778079" keyboardType="number-pad" value={journalBirds} onChangeText={setJournalBirds} /><TextInput style={[styles.input, styles.notes]} placeholder="Conditions, harvest, dog work and notes…" placeholderTextColor="#778079" multiline value={journalNotes} onChangeText={setJournalNotes} /><Pressable style={styles.primaryButton} onPress={logHunt}><Text style={styles.primaryButtonText}>Save Hunt</Text></Pressable></View>}
            {!journalEntries.length && !journalForm && <View style={styles.emptyState}><Text style={styles.emptyStateIcon}>▤</Text><Text style={styles.panelTitle}>Start your season log</Text><Text style={styles.subtle}>Keep locations, conditions, birds and dog work together.</Text></View>}
            {journalEntries.map((entry) => <View style={styles.journalCard} key={entry.id}><View style={styles.journalDate}><Text style={styles.journalDateText}>{entry.createdAt}</Text></View><View style={styles.flex}><Text style={styles.panelTitle}>{entry.location}</Text><Text style={styles.reportDate}>{entry.birds} birds seen</Text><Text style={styles.subtle}>{entry.notes || 'No notes added.'}</Text>{entry.ownerId === session.user.id ? <ShareToggle shared={entry.shared} onPress={() => toggleEntrySharing('journal', entry.id, entry.shared)} /> : <Text style={styles.sharedByLabel}>SHARED BY A LINKED HUNTER</Text>}</View></View>)}
          </ScrollView>
        )}

        {tab === 'Profile' && (
          <ScrollView contentContainerStyle={styles.page}>
            <Text style={styles.eyebrow}>BEARDED DUCK</Text>
            <Text style={styles.pageTitle}>Field Profile</Text>
            <View style={styles.profileCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>J</Text></View>
              <Text style={styles.profileName}>Jake</Text>
              <Text style={styles.subtle}>{session.user.email}</Text>
            </View>
            <View style={styles.synopsisCard}>
              <Text style={styles.synopsisTitle}>Sharing & Privacy</Text>
              <View style={styles.synopsisRow}><Text style={styles.synopsisIcon}>🔗</Text><View style={styles.flex}><Text style={styles.rowTitle}>Link first</Text><Text style={styles.synopsisText}>Both hunters must connect through the invited email address before either account can receive shared information.</Text></View></View>
              <View style={styles.synopsisRow}><Text style={styles.synopsisIcon}>⌖</Text><View style={styles.flex}><Text style={styles.rowTitle}>Grant each waypoint</Text><Text style={styles.synopsisText}>Linking an account never exposes your whole map. You choose each person for each waypoint below.</Text></View></View>
              <View style={styles.synopsisRow}><Text style={styles.synopsisIcon}>▣</Text><View style={styles.flex}><Text style={styles.rowTitle}>Share cameras separately</Text><Text style={styles.synopsisText}>Tactacam access is controlled camera by camera and can be removed without changing waypoint access.</Text></View></View>
              <View style={styles.synopsisRow}><Text style={styles.synopsisIcon}>▤</Text><View style={styles.flex}><Text style={styles.rowTitle}>Entries start private</Text><Text style={styles.synopsisText}>Every journal entry and report starts off. Turn sharing on for only the entries you want linked hunters to see.</Text></View></View>
              <Text style={styles.synopsisFoot}>Weather and radar are live public weather data. Your coordinates, photos, journal, cameras, and account details are not made public.</Text>
            </View>
            <View style={styles.panel}><Text style={styles.panelTitle}>Linked Accounts</Text><Text style={styles.privacyNotice}>Nothing is shared until both accounts are linked by email and you grant access below.</Text><View style={styles.inlineInputs}><TextInput style={[styles.input, styles.flex]} autoCapitalize="none" keyboardType="email-address" placeholder="hunter@email.com" placeholderTextColor="#778079" value={inviteEmail} onChangeText={setInviteEmail} /><Pressable style={styles.inviteButton} onPress={sendInvitation}><Text style={styles.primaryButtonText}>Invite</Text></Pressable></View>{linkedHunters.map((hunter) => <View style={styles.linkedRow} key={hunter.id}><View style={styles.linkedAvatar}><Text style={styles.linkedAvatarText}>{(hunter.display_name || hunter.email).charAt(0).toUpperCase() || '?'}</Text></View><View style={styles.flex}><Text style={styles.rowTitle}>{hunter.display_name || hunter.email.split('@')[0]}</Text><Text style={styles.subtle}>{hunter.email}</Text></View><Text style={styles.linkedStatus}>LINKED</Text></View>)}</View>
            {invitations.filter((invite) => invite.invitee_email.toLowerCase() === session.user.email?.toLowerCase() && invite.status === 'pending').map((invite) => <View style={styles.inviteCard} key={invite.id}><Text style={styles.panelTitle}>Account link request</Text><Text style={styles.subtle}>A DuckCast user invited {invite.invitee_email}.</Text><View style={styles.inlineInputs}><Pressable style={[styles.primaryButton, styles.flex]} onPress={() => respondToInvitation(invite.id, 'accepted')}><Text style={styles.primaryButtonText}>Accept</Text></Pressable><Pressable style={[styles.deleteButton, styles.flex]} onPress={() => respondToInvitation(invite.id, 'declined')}><Text style={styles.deleteText}>Decline</Text></Pressable></View></View>)}
            <View style={styles.panel}><Text style={styles.panelTitle}>Waypoint Sharing</Text><Text style={styles.subtle}>Choose exactly which linked hunters can see each waypoint.</Text>{waypoints.map((point) => <View style={styles.shareItem} key={point.id}><Text style={styles.rowTitle}>{point.name}</Text><View style={styles.shareChips}>{linkedHunters.map((hunter) => { const active = (waypointGrants[point.id] ?? []).includes(hunter.id); return <Pressable key={hunter.id} style={[styles.shareChip, active && styles.shareChipActive]} onPress={() => toggleGrant('waypoint', point.id, hunter.id)}><Text style={[styles.shareChipText, active && styles.shareChipTextActive]}>{hunter.display_name || hunter.email.split('@')[0]} {active ? '✓' : '+'}</Text></Pressable>; })}</View></View>)}</View>
            <View style={styles.panel}><Text style={styles.panelTitle}>Tactacam Sharing</Text><Text style={styles.subtle}>Each camera stays private until you enable a linked hunter here.</Text><View style={styles.inlineInputs}><TextInput style={[styles.input, styles.flex]} placeholder="Camera name" placeholderTextColor="#778079" value={cameraName} onChangeText={setCameraName} /><Pressable style={styles.inviteButton} onPress={addCamera}><Text style={styles.primaryButtonText}>Add</Text></Pressable></View>{cameras.map((camera) => <View style={styles.shareItem} key={camera.id}><Text style={styles.rowTitle}>{camera.name}</Text><View style={styles.shareChips}>{linkedHunters.map((hunter) => { const active = (cameraGrants[camera.id] ?? []).includes(hunter.id); return <Pressable key={hunter.id} style={[styles.shareChip, active && styles.shareChipActive]} onPress={() => toggleGrant('camera', camera.id, hunter.id)}><Text style={[styles.shareChipText, active && styles.shareChipTextActive]}>{hunter.display_name || hunter.email.split('@')[0]} {active ? '✓' : '+'}</Text></Pressable>; })}</View></View>)}</View>
            <Pressable style={styles.signOutButton} onPress={() => supabase.auth.signOut()}><Text style={styles.deleteText}>Sign Out</Text></Pressable>
          </ScrollView>
        )}
      </View>

      <Modal visible={mapControls} transparent animationType="fade" onRequestClose={() => setMapControls(false)}>
        <Pressable style={styles.controlBackdrop} onPress={() => setMapControls(false)}>
          <View style={styles.mapControlCard}>
            <Text style={styles.mapControlTitle}>Map Display · {activeState}</Text>
            <Text style={styles.stateSource}>{STATE_LAND_SOURCES[activeState]?.name ?? activeState}: {STATE_LAND_SOURCES[activeState]?.publicDetail ?? 'nationwide public-land coverage'}</Text>
            <Pressable style={styles.controlRow} onPress={() => setShowWaypoints((value) => !value)}>
              <Text style={styles.rowTitle}>Waypoints</Text><Text style={styles.controlValue}>{showWaypoints ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable style={styles.controlRow} onPress={() => setShowPublicLands((value) => !value)}>
              <View><Text style={styles.rowTitle}>Nationwide Public Lands</Text><Text style={styles.controlSub}>Access status + land and manager names</Text></View><Text style={styles.controlValue}>{showPublicLands ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable style={styles.controlRow} onPress={() => setShowBoundaries((value) => !value)}>
              <View><Text style={styles.rowTitle}>Property Boundaries</Text><Text style={styles.controlSub}>{STATE_LAND_SOURCES[activeState]?.parcels ?? 'State source not yet connected'}</Text></View><Text style={styles.controlValue}>{showBoundaries ? 'ON' : 'OFF'}</Text>
            </Pressable>
            {(showPublicLands || showBoundaries) && region.latitudeDelta * 69 > 5 && <Text style={styles.boundaryHint}>Zoom within 5 miles to load boundaries and names.</Text>}
            {showPublicLands && <View style={styles.landLegend}><View style={[styles.legendDot, { backgroundColor: '#63D47E' }]} /><Text style={styles.legendText}>Open</Text><View style={[styles.legendDot, { backgroundColor: '#F1C453' }]} /><Text style={styles.legendText}>Restricted</Text><View style={[styles.legendDot, { backgroundColor: '#EA6C65' }]} /><Text style={styles.legendText}>Closed</Text><View style={[styles.legendDot, { backgroundColor: '#9A8EB4' }]} /><Text style={styles.legendText}>Unknown</Text></View>}
            <Pressable style={styles.controlRow} onPress={() => setShowRadar((value) => !value)}>
              <View><Text style={styles.rowTitle}>Precipitation Radar</Text><Text style={styles.controlSub}>Continuously animated rolling radar</Text></View><Text style={styles.controlValue}>{showRadar ? 'ON' : 'OFF'}</Text>
            </Pressable>
            {showRadar && <View style={styles.radarCycleRow}><View><Text style={styles.rowTitle}>30-Minute Loop</Text><Text style={styles.controlSub}>Cycles oldest to newest continuously</Text></View><Text style={styles.controlValue}>LIVE</Text></View>}
            <Pressable style={styles.controlRow} onPress={() => setShowWind((value) => !value)}>
              <View><Text style={styles.rowTitle}>Waypoint Wind</Text><Text style={styles.controlSub}>Compass + speed at each pin</Text></View><Text style={styles.controlValue}>{showWind ? 'ON' : 'OFF'}</Text>
            </Pressable>
            <Pressable style={styles.controlRow} onPress={() => setMapType((value) => value === 'hybrid' ? 'satellite' : 'hybrid')}>
              <Text style={styles.rowTitle}>Map Style</Text><Text style={styles.controlValue}>{mapType.toUpperCase()}</Text>
            </Pressable>
            <Text style={styles.controlHint}>Long-press to add · Drag a marker to move it</Text>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={moreMenu} transparent animationType="fade" onRequestClose={() => setMoreMenu(false)}>
        <Pressable style={styles.controlBackdrop} onPress={() => setMoreMenu(false)}>
          <View style={styles.moreMenuCard}>
            <Text style={styles.mapControlTitle}>{selected?.name}</Text>
            <Pressable style={styles.controlRow} onPress={() => { if (selected) { setDraftName(selected.name); setDraftType(selected.type); setDraftColor(selected.color); } setMoreMenu(false); setEditing(true); }}>
              <Text style={styles.rowTitle}>Edit waypoint</Text><Text style={styles.chevron}>›</Text>
            </Pressable>
            <Pressable style={styles.controlRow} onPress={centerSelectedWaypoint}><Text style={styles.rowTitle}>Center on map</Text><Text style={styles.chevron}>›</Text></Pressable>
            <Pressable style={styles.controlRow} onPress={() => { togglePrivacy(); setMoreMenu(false); }}><Text style={styles.rowTitle}>{selected?.private ? 'Make shared' : 'Make private'}</Text><Text style={styles.chevron}>›</Text></Pressable>
            <Pressable style={styles.controlRow} onPress={confirmDeleteWaypoint}><Text style={styles.deleteText}>Delete waypoint</Text><Text style={styles.deleteText}>›</Text></Pressable>
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
                  <Text style={[styles.typeOptionText, draftType === type && styles.optionTextActive]}>{WAYPOINT_ICONS[type]}  {type}</Text>
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
            <Pressable style={styles.deleteButton} onPress={deleteWaypoint}>
              <Text style={styles.deleteText}>Delete Waypoint</Text>
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

function featureCenter(geometry: any) {
  const points: Array<{ latitude: number; longitude: number }> = [];
  const walk = (coordinates: any) => {
    if (Array.isArray(coordinates) && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      points.push({ longitude: coordinates[0], latitude: coordinates[1] });
    } else if (Array.isArray(coordinates)) coordinates.forEach(walk);
  };
  walk(geometry?.coordinates);
  if (!points.length) return null;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
}

const EMPTY_COLLECTION = { type: 'FeatureCollection', features: [] };

function LandLayers({ data }: { data: Record<string, any> }) {
  return <>
    <Geojson geojson={data.Open ?? EMPTY_COLLECTION} fillColor="rgba(44,160,78,0.32)" strokeColor="#63D47E" strokeWidth={1.2} />
    <Geojson geojson={data.Restricted ?? EMPTY_COLLECTION} fillColor="rgba(230,174,55,0.28)" strokeColor="#F1C453" strokeWidth={1.2} />
    <Geojson geojson={data.Closed ?? EMPTY_COLLECTION} fillColor="rgba(198,70,63,0.25)" strokeColor="#EA6C65" strokeWidth={1.2} />
    <Geojson geojson={data.Unknown ?? EMPTY_COLLECTION} fillColor="rgba(123,111,150,0.22)" strokeColor="#9A8EB4" strokeWidth={1.2} />
  </>;
}

function LandLabels({ labels }: { labels: LandLabel[] }) {
  return <>{labels.map((label) => (
    <Marker key={label.id} coordinate={label} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={[styles.landLabel, label.kind === 'public' ? styles.publicLandLabel : styles.parcelLandLabel]}>
        <Text numberOfLines={1} style={styles.landLabelText}>{label.name}</Text>
      </View>
    </Marker>
  ))}</>;
}

function groupGrants(rows: Record<string, string>[], key: string) {
  return rows.reduce<Record<string, string[]>>((grouped, row) => {
    const itemId = row[key];
    if (!itemId || !row.viewer_id) return grouped;
    grouped[itemId] = [...(grouped[itemId] ?? []), row.viewer_id];
    return grouped;
  }, {});
}

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!email.trim() || password.length < 6) { Alert.alert('DuckCast account', 'Enter your email and a password of at least 6 characters.'); return; }
    setBusy(true);
    const result = registering ? await supabase.auth.signUp({ email: email.trim().toLowerCase(), password }) : await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (result.error) Alert.alert('DuckCast account', result.error.message);
    else if (registering && !result.data.session) Alert.alert('Check your email', 'Confirm your DuckCast account, then sign in.');
  }
  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><BrandHeader /><ScrollView contentContainerStyle={styles.authPage}><Text style={styles.eyebrow}>PRIVATE BY DEFAULT</Text><Text style={styles.pageTitle}>{registering ? 'Create Account' : 'Welcome Back'}</Text><Text style={styles.authIntro}>Your locations, reports and cameras stay private unless you link another account by email and grant access.</Text><View style={styles.composerCard}><TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#778079" value={email} onChangeText={setEmail} /><TextInput style={styles.input} secureTextEntry placeholder="Password" placeholderTextColor="#778079" value={password} onChangeText={setPassword} /><Pressable style={styles.primaryButton} onPress={submit} disabled={busy}><Text style={styles.primaryButtonText}>{busy ? 'Please wait…' : registering ? 'Create DuckCast Account' : 'Sign In'}</Text></Pressable><Pressable style={styles.cancelButton} onPress={() => setRegistering((value) => !value)}><Text style={styles.cancelText}>{registering ? 'Already have an account? Sign in' : 'New to DuckCast? Create an account'}</Text></Pressable></View></ScrollView></SafeAreaView>;
}

function BrandHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <Image source={{ uri: DUCK_LOGO_URI }} style={styles.duckLogo} resizeMode="contain" />
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

function WindMarker({ point, wind, showWind, showLabel, onPress, onMove }: { point: Waypoint; wind?: WindReading; showWind: boolean; showLabel: boolean; onPress: () => void; onMove: (latitude: number, longitude: number) => void }) {
  return (
    <Marker coordinate={point} title={showLabel ? `${point.type}: ${point.name}` : undefined} draggable onPress={onPress} onDragEnd={(event) => onMove(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude)} anchor={{ x: 0.5, y: 1 }}>
      <View style={styles.windMarkerWrap}>
        {showWind && <View style={styles.windBadge}><Text style={[styles.windArrow, { transform: [{ rotate: `${wind?.direction ?? 0}deg` }] }]}>↑</Text><View><Text style={styles.windSpeed}>{wind ? `${wind.speed.toFixed(0)} mph` : '…'}</Text><Text style={styles.windDirection}>{wind ? `${wind.direction.toFixed(0)}°` : 'loading'}</Text></View></View>}
        <View style={[styles.customPin, { backgroundColor: point.color }]}>
          <Text style={[styles.waypointIcon, point.type === 'Hunt Spot' && styles.duckWaypointIcon]}>{WAYPOINT_ICONS[point.type]}</Text>
        </View>
      </View>
    </Marker>
  );
}

function WaypointDropdown({ waypoints, selectedId, onSelect }: { waypoints: Waypoint[]; selectedId: string; onSelect: (point: Waypoint) => void }) {
  const [open, setOpen] = useState(false);
  const selected = waypoints.find((point) => point.id === selectedId);
  return <View style={styles.dropdownWrap}>
    <Pressable style={styles.dropdownButton} onPress={() => setOpen((value) => !value)}>
      <Text style={styles.dropdownText}>{selected ? `${WAYPOINT_ICONS[selected.type]}  ${selected.name}` : 'Choose a waypoint'}</Text><Text style={styles.dropdownArrow}>{open ? '▲' : '▼'}</Text>
    </Pressable>
    {open && <ScrollView style={styles.dropdownMenu} nestedScrollEnabled>{waypoints.map((point) => <Pressable key={point.id} style={styles.dropdownOption} onPress={() => { onSelect(point); setOpen(false); }}><Text style={styles.waypointChoiceIcon}>{WAYPOINT_ICONS[point.type]}</Text><View style={styles.flex}><Text style={styles.rowTitle}>{point.name}</Text><Text style={styles.controlSub}>{point.type}</Text></View>{selectedId === point.id && <Text style={styles.controlValue}>✓</Text>}</Pressable>)}</ScrollView>}
  </View>;
}

function ShareToggle({ shared, onPress }: { shared: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.shareToggleRow} onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: shared }}>
      <View><Text style={styles.shareToggleTitle}>Share with linked accounts</Text><Text style={styles.shareToggleStatus}>{shared ? 'ON · Linked hunters can view this entry' : 'OFF · Private to you'}</Text></View>
      <View style={[styles.switchTrack, shared && styles.switchTrackOn]}><View style={[styles.switchKnob, shared && styles.switchKnobOn]} /></View>
    </Pressable>
  );
}

function WeatherPanel({ weather, loading, onRefresh }: { weather: Weather | null; loading: boolean; onRefresh: () => void }) {
  const [range, setRange] = useState<'Hourly' | '24 Hours' | '72 Hours' | '7 Day'>('Hourly');
  const [selectedDay, setSelectedDay] = useState(0);
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
      <View style={styles.compactForecastTabs}>
        {(['Hourly', '24 Hours', '72 Hours', '7 Day'] as const).map((item) => (
          <Pressable key={item} style={[styles.compactForecastTab, range === item && styles.compactForecastTabActive]} onPress={() => { setRange(item); setSelectedDay(0); }}>
            <Text style={[styles.compactForecastText, range === item && styles.compactForecastTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {range !== '7 Day' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyRail}>
          {weather.hourly.slice(0, range === 'Hourly' ? 12 : range === '24 Hours' ? 24 : 72).map((hour, index) => <View style={styles.hourCard} key={`${hour.time}-${index}`}><Text style={styles.hourTime}>{hour.time}</Text><Text style={styles.hourTemp}>{hour.temp.toFixed(0)}°</Text><Text style={styles.hourRain}>● {hour.precipChance.toFixed(0)}%</Text><Text style={styles.hourWind}>{hour.wind.toFixed(0)} mph</Text></View>)}
        </ScrollView>
      ) : (
        <View style={styles.dayForecastWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {weather.daily.slice(0, 7).map((day, index) => (
              <Pressable key={`${day.date}-${index}`} style={[styles.dayCard, selectedDay === index && styles.dayCardActive]} onPress={() => setSelectedDay(index)}><Text style={styles.dayCardName}>{day.date}</Text><Text style={styles.dayCardTemp}>{day.high.toFixed(0)}°</Text><Text style={styles.dayCardLow}>{day.low.toFixed(0)}°</Text></Pressable>
            ))}
          </ScrollView>
          {!!weather.daily[selectedDay] && <View style={styles.selectedDayDetails}><Text style={styles.selectedDayTitle}>{weather.daily[selectedDay].date} forecast</Text><Text style={styles.selectedDayStat}>Rain {weather.daily[selectedDay].rainChance.toFixed(0)}% · {weather.daily[selectedDay].rain.toFixed(2)} in</Text><Text style={styles.selectedDayStat}>Wind up to {weather.daily[selectedDay].wind.toFixed(0)} mph</Text></View>}
        </View>
      )}
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
  duckLogo: { width: 42, height: 42 },
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
  tipClose: { position: 'absolute', right: 8, top: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  tipCloseText: { color: '#FFFFFF', fontSize: 22, lineHeight: 24 },
  cleanSlateTitle: { color: '#EADCCB', fontFamily: 'Georgia', fontSize: 21, fontWeight: '800' },
  cleanSlateText: { color: '#A5AEA8', lineHeight: 19, marginTop: 5 },
  landLabel: { maxWidth: 138, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  publicLandLabel: { backgroundColor: 'rgba(8,35,19,0.88)', borderColor: '#63D47E' },
  parcelLandLabel: { backgroundColor: 'rgba(24,22,14,0.88)', borderColor: '#FFEBAF' },
  landLabelText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
  boundaryHint: { color: '#F1C453', fontSize: 11, lineHeight: 15, paddingHorizontal: 12, paddingBottom: 7 },
  landLegend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, paddingHorizontal: 12, paddingBottom: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 2, marginLeft: 4 },
  legendText: { color: '#AAB3AD', fontSize: 9, marginRight: 2 },
  mapCard: { height: 285, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#38463F', backgroundColor: '#1A2A20' },
  mapTopRow: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between' },
  glassButton: { backgroundColor: 'rgba(5,13,9,0.78)', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  glassText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  fullMapText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
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
  moreMenuCard: { position: 'absolute', top: 190, right: 18, width: 245, backgroundColor: '#0E1D15', borderRadius: 17, borderWidth: 1, borderColor: '#506158', padding: 15 },
  weatherPanel: { marginHorizontal: 1, backgroundColor: '#13231B', borderWidth: 1, borderColor: '#3A4B42', borderRadius: 16, padding: 13 },
  weatherTitle: { color: '#E7DAC9', fontSize: 18, fontWeight: '800' },
  weatherHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  refreshText: { color: ORANGE, fontSize: 10, fontWeight: '800' },
  weatherEmpty: { color: '#9FA9A3', paddingVertical: 18, textAlign: 'center' },
  hourlyRail: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#34463C', paddingTop: 10 },
  compactForecastTabs: { flexDirection: 'row', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#34463C' },
  compactForecastTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#34463C' },
  compactForecastTabActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  compactForecastText: { color: '#9FA9A3', fontSize: 11, fontWeight: '800' },
  compactForecastTextActive: { color: '#FFFFFF' },
  dayForecastWrap: { marginTop: 10 },
  dayCard: { width: 62, marginRight: 7, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: '#0C1A13', borderWidth: 1, borderColor: '#2F4237' },
  dayCardActive: { borderColor: ORANGE, backgroundColor: '#1A2A20' },
  dayCardName: { color: '#AAB3AD', fontSize: 10, fontWeight: '800' },
  dayCardTemp: { color: '#F1E7D8', fontSize: 18, fontWeight: '900', marginTop: 3 },
  dayCardLow: { color: '#849087', fontSize: 11 },
  selectedDayDetails: { marginTop: 9, padding: 10, borderRadius: 9, backgroundColor: '#0C1A13', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 },
  selectedDayTitle: { width: '100%', color: '#EADCCB', fontWeight: '900' },
  selectedDayStat: { color: '#AAB3AD', fontSize: 11 },
  hourCard: { width: 65, alignItems: 'center', paddingVertical: 7, marginRight: 6, borderRadius: 9, backgroundColor: '#0C1A13' },
  hourTime: { color: '#96A099', fontSize: 10 },
  hourTemp: { color: '#F1E7D8', fontSize: 17, fontWeight: '800', marginTop: 3 },
  hourWind: { color: ORANGE, fontSize: 9, marginTop: 2 },
  hourRain: { color: '#73A9CC', fontSize: 9, fontWeight: '800', marginTop: 2 },
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
  stateSource: { color: '#91A69A', fontSize: 9, lineHeight: 13, marginBottom: 5 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 47, borderBottomWidth: 1, borderBottomColor: '#293A31' },
  controlValue: { color: ORANGE, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  controlSub: { color: '#7F8C84', fontSize: 9, marginTop: 2 },
  radarCycleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#293A31' },
  cycleButtons: { flexDirection: 'row', gap: 5 },
  cycleButton: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#405047' },
  cycleButtonActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  cycleButtonText: { color: '#A9B1AB', fontSize: 9, fontWeight: '900' },
  cycleButtonTextActive: { color: '#FFFFFF' },
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
  deleteButton: { paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#7A3D38', borderRadius: 11 },
  deleteText: { color: '#E2786E', fontWeight: '800' },
  cancelButton: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#A9B1AB', fontWeight: '700' },
  photoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: '100%', height: '78%' },
  closePhoto: { position: 'absolute', top: 54, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(18,35,27,0.9)', alignItems: 'center', justifyContent: 'center' },
  closePhotoText: { color: '#FFFFFF', fontSize: 30, lineHeight: 32 },
  radarLegend: { position: 'absolute', left: 12, bottom: 42, backgroundColor: 'rgba(5,13,9,0.88)', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  fullRadarLegend: { position: 'absolute', left: 14, top: 14, backgroundColor: 'rgba(5,13,9,0.88)', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  radarLegendTitle: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  radarColors: { flexDirection: 'row', marginTop: 4 },
  radarColor: { width: 28, height: 4 },
  windMarkerWrap: { alignItems: 'center' },
  windBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(8,21,16,0.94)', borderWidth: 1, borderColor: '#EADCCB', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, marginBottom: 3 },
  windArrow: { color: ORANGE, fontSize: 19, fontWeight: '900' },
  windSpeed: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  windDirection: { color: '#9EA8A1', fontSize: 8 },
  customPin: { minWidth: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: '#FFF4E8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  waypointIcon: { color: '#FFFFFF', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  duckWaypointIcon: { fontSize: 10 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countPill: { minWidth: 58, alignItems: 'center', padding: 8, borderRadius: 12, backgroundColor: '#14231B', borderWidth: 1, borderColor: '#3A4D42' },
  countPillNumber: { color: ORANGE, fontSize: 20, fontWeight: '900' },
  countPillLabel: { color: '#89958D', fontSize: 8, fontWeight: '900' },
  composerCard: { backgroundColor: '#122219', borderWidth: 1, borderColor: '#45594D', borderRadius: 18, padding: 15, gap: 10 },
  pickerLabel: { color: '#7F8C84', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginTop: 2 },
  waypointChoice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 7, paddingHorizontal: 10, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#405047', backgroundColor: '#0A1710' },
  waypointChoiceActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  waypointChoiceIcon: { fontSize: 12 },
  waypointChoiceText: { color: '#B4BDB7', fontSize: 10, fontWeight: '800' },
  waypointChoiceTextActive: { color: '#FFFFFF' },
  dropdownWrap: { position: 'relative', zIndex: 5 },
  dropdownButton: { minHeight: 46, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: '#3A4B41', backgroundColor: '#0A1710', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { color: '#F4EEE5', fontSize: 13, fontWeight: '700' },
  dropdownArrow: { color: ORANGE, fontSize: 10 },
  dropdownMenu: { maxHeight: 190, borderWidth: 1, borderTopWidth: 0, borderColor: '#45594D', borderBottomLeftRadius: 11, borderBottomRightRadius: 11, backgroundColor: '#0C1A13' },
  dropdownOption: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#293A31' },
  inlineInputs: { flexDirection: 'row', gap: 8 },
  emptyState: { alignItems: 'center', backgroundColor: '#0D1B14', borderWidth: 1, borderStyle: 'dashed', borderColor: '#3A4D42', borderRadius: 18, padding: 28, gap: 6 },
  emptyStateIcon: { color: ORANGE, fontSize: 30 },
  reportCard: { backgroundColor: '#122219', borderLeftWidth: 4, borderLeftColor: ORANGE, borderRadius: 14, padding: 15, gap: 10 },
  shareToggleRow: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2C3C33', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  shareToggleTitle: { color: '#E8E3DA', fontSize: 12, fontWeight: '800' },
  shareToggleStatus: { color: '#89958D', fontSize: 9, marginTop: 2 },
  switchTrack: { width: 43, height: 24, borderRadius: 12, padding: 3, backgroundColor: '#435047' },
  switchTrackOn: { backgroundColor: ORANGE },
  switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF' },
  switchKnobOn: { alignSelf: 'flex-end' },
  sharedByLabel: { color: '#73B884', fontSize: 9, fontWeight: '900', marginTop: 6 },
  reportDate: { color: '#8F9A93', fontSize: 11, marginTop: 3 },
  birdCountBadge: { minWidth: 52, alignItems: 'center', padding: 7, borderRadius: 10, backgroundColor: '#0A1710' },
  birdCountLabel: { color: '#87928B', fontSize: 8, fontWeight: '900' },
  addHuntButton: { backgroundColor: ORANGE, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11 },
  seasonStats: { flexDirection: 'row', backgroundColor: '#13231B', borderRadius: 17, borderWidth: 1, borderColor: '#3A4D42', paddingVertical: 16 },
  statBlock: { flex: 1, alignItems: 'center' },
  statNumber: { color: '#F3E9DB', fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#87928B', fontSize: 8, fontWeight: '900', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#34463C' },
  journalCard: { flexDirection: 'row', gap: 12, backgroundColor: '#122219', borderRadius: 14, padding: 14 },
  journalDate: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#1C3025', alignItems: 'center', justifyContent: 'center' },
  journalDateText: { color: ORANGE, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  authLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  authPage: { padding: 22, paddingTop: 52, gap: 14 },
  authIntro: { color: '#A7B0AA', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  privacyNotice: { color: '#B9C1BC', fontSize: 12, lineHeight: 18, backgroundColor: '#0A1710', borderRadius: 9, padding: 10 },
  synopsisCard: { backgroundColor: '#15271D', borderWidth: 1, borderColor: '#4B6254', borderRadius: 17, padding: 15, gap: 12 },
  synopsisTitle: { color: '#EADCCB', fontFamily: 'Georgia', fontSize: 22, fontWeight: '800' },
  synopsisRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  synopsisIcon: { width: 28, color: ORANGE, fontSize: 20, textAlign: 'center' },
  synopsisText: { color: '#AAB4AD', fontSize: 12, lineHeight: 17, marginTop: 2 },
  synopsisFoot: { color: '#D5CABA', fontSize: 11, lineHeight: 16, backgroundColor: '#0A1710', borderRadius: 9, padding: 10 },
  inviteButton: { minWidth: 68, backgroundColor: ORANGE, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2C3C33' },
  linkedAvatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#1D3427', alignItems: 'center', justifyContent: 'center' },
  linkedAvatarText: { color: ORANGE, fontWeight: '900' },
  linkedStatus: { color: '#73B884', fontSize: 9, fontWeight: '900' },
  inviteCard: { backgroundColor: '#18291F', borderWidth: 1, borderColor: ORANGE, borderRadius: 15, padding: 14, gap: 10 },
  shareItem: { gap: 8, paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#2C3C33' },
  shareChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shareChip: { borderWidth: 1, borderColor: '#45564D', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  shareChipActive: { backgroundColor: '#28553A', borderColor: '#5A9B70' },
  shareChipText: { color: '#A5AEA8', fontSize: 10, fontWeight: '800' },
  shareChipTextActive: { color: '#FFFFFF' },
  signOutButton: { borderWidth: 1, borderColor: '#70413D', borderRadius: 11, padding: 13, alignItems: 'center' },
});
