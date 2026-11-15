// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VYOMAASTRA â€” Core Telemetry Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Raw bridge packet (flat legacy format from bridge.js) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface RawLegacyPacket {
  packetNo: number;
  timestamp: number;
  temperature?: number;
  humidity?: number;
  ax?: number;
  ay?: number;
  az?: number;
  totalAcc?: number;
  gx?: number;
  gy?: number;
  gz?: number;
  roll?: number;
  pitch?: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  speed?: number;
  satellites?: number;
  gpsFix?: number;
}

// â”€â”€ Future nested format (for upcoming sensors) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface RawNestedPacket {
  schemaVersion: 1;
  missionId: string;
  deviceId: string;
  packetNo: number;
  timestamp: number;
  sensors: Record<string, Record<string, number> | null>;
}

export type RawPacket = RawLegacyPacket | RawNestedPacket;

// â”€â”€ Normalized telemetry reading (internal model) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type DataQuality = 'ok' | 'stale' | 'invalid' | 'estimated';
export type TimestampSource = 'packet' | 'bridge' | 'fallback';

export interface NormalizedReading {
  sensorId: string;       // e.g. "dht11"
  fieldKey: string;       // e.g. "temperature"
  value: number;
  unit: string;           // e.g. "Â°C"
  timestamp: number;      // Unix ms â€” preserved from packet, never fabricated
  timestampSource: TimestampSource;
  packetNo: number | null;
  quality: DataQuality;
  deviceId: string;
  missionId: string;
}

export interface NormalizedPacket {
  raw: unknown;
  packetNo: number | null;
  timestamp: number;
  timestampSource: TimestampSource;
  readings: NormalizedReading[];
  parseWarnings: string[];
}

// â”€â”€ Sensor field definition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type DataType = 'number' | 'integer' | 'boolean' | 'string';
export type ChartType = 'timeseries' | 'area' | 'bar' | 'gauge' | 'value' | 'table' | 'map' | 'cubesat';

export interface AlertThreshold {
  low?: number;
  high?: number;
  critical_low?: number;
  critical_high?: number;
}

export interface SensorFieldDefinition {
  fieldKey: string;        // e.g. "temperature"
  label: string;           // e.g. "Temperature"
  unit: string;            // e.g. "Â°C"
  dataType: DataType;
  min?: number;
  max?: number;
  precision?: number;
  defaultChartType?: ChartType;
  alertThresholds?: AlertThreshold;
  description?: string;
}

// â”€â”€ Sensor definition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type SensorStatus =
  | 'configured'   // selected in wizard, no data yet
  | 'receiving'    // actively receiving data
  | 'stale'        // last data > 10s ago
  | 'error'        // adapter threw
  | 'disabled';    // manually disabled

export interface SensorDefinition {
  sensorId: string;        // unique, e.g. "dht11"
  displayName: string;     // e.g. "DHT11"
  sensorType: string;      // e.g. "temperature_humidity"
  description: string;
  iconName: string;        // Lucide icon name
  enabled: boolean;
  deviceId: string;
  fields: SensorFieldDefinition[];
  status: SensorStatus;
  lastSeenTimestamp: number | null;
  lastReadings: Record<string, number | null>;
  readingRateHz?: number;
}

// â”€â”€ Mission configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface MissionConfig {
  missionName: string;
  deviceId: string;
  wsUrl: string;
  configuredSensorIds: string[];
  isSetupComplete: boolean;
  setupVersion: number;
  createdAt: number;
  updatedAt: number;
}

// â”€â”€ Widget configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface WidgetConfig {
  id: string;
  type: ChartType;
  title: string;
  fields: string[];        // e.g. ["dht11.temperature"]
  timeRange: TimeRange;
  autoScale: boolean;
  yMin?: number;
  yMax?: number;
  color?: string;
  lineWidth?: number;
  showPoints?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  smoothing?: boolean;
  unit?: string;
  alertThresholds?: AlertThreshold;
  sensorCategory?: string; // e.g. "dht11" | "mpu6050" | "gps" | "bmp280"
}

export type TimeRange = 'live' | '1m' | '5m' | '15m' | '1h' | '6h' | 'custom';

export interface CustomTimeRange {
  from: number;  // Unix ms
  to: number;    // Unix ms
}

// â”€â”€ Dashboard layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface GridItemLayout {
  i: string;      // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: WidgetConfig[];
  gridLayout: GridItemLayout[];
  createdAt: number;
  updatedAt: number;
}

// â”€â”€ Connection state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'stale'
  | 'error';

// â”€â”€ Telemetry store shape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface PacketDiagnostics {
  received: number;
  invalid: number;
  lastPacketNo: number | null;
  lastTimestamp: number | null;
  duplicateCount: number;
  missedCount: number;
  lastRawJson: string | null;
  lastNormalizedPacket: NormalizedPacket | null;
  validationErrors: string[];
  connectionEvents: ConnectionEvent[];
}

export interface ConnectionEvent {
  at: number;       // Unix ms
  type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
  detail?: string;
}

// â”€â”€ Field sample (stored in ring buffer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface FieldSample {
  timestamp: number;   // Unix ms
  value: number;
  quality: DataQuality;
}

// â”€â”€ Alert â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface TelemetryAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  fieldRef?: string;   // "sensorId.fieldKey"
  triggeredAt: number;
  acknowledged: boolean;
}
