import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { realChargingStationService } from '@/services/realChargingStationService';
import { ChargingStation } from '@/types/ev';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => void })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom charging station icons
const createChargingIcon = (station: ChargingStation) => {
  const getColor = () => {
    if (!station.isAvailable) return '#ef4444';
    if (station.maxPower >= 150) return '#10b981'; // Fast charging - green
    if (station.maxPower >= 50) return '#f59e0b'; // Medium charging - yellow
    return '#6b7280'; // Slow charging - gray
  };

  const color = getColor();
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background-color: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: white;
        "></div>
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          width: 16px;
          height: 16px;
          background-color: ${station.network === 'Tesla' ? '#e11d48' : station.network === 'DEWA' ? '#0ea5e9' : '#6b7280'};
          border-radius: 50%;
          font-size: 8px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        ">
          ${station.maxPower}
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

interface FreeMapProps {
  onStationSelect?: (station: ChargingStation) => void;
  className?: string;
}

const FreeMap: React.FC<FreeMapProps> = ({ onStationSelect, className = '' }) => {
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapCenter] = useState<[number, number]>([25.2048, 55.2708]); // Dubai center

  const handleStationClick = (station: ChargingStation) => {
    setSelectedStation(station);
    onStationSelect?.(station);
  };

  useEffect(() => {
    setMapReady(true);
    loadChargingStations();
  }, []);

  const loadChargingStations = async () => {
    try {
      setLoading(true);
      const response = await realChargingStationService.getNearbyStations({
        lat: mapCenter[0],
        lng: mapCenter[1],
        radiusKm: 500, // Large radius to cover UAE and neighboring areas
      });
      setChargingStations(response.stations);
    } catch (error) {
      console.error('Failed to load charging stations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!mapReady) {
    return (
      <div className={`${className} relative overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden rounded-lg border border-border`}>
      <MapContainer
        center={mapCenter}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {chargingStations.map((station) => (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={createChargingIcon(station)}
            eventHandlers={{
              click: () => handleStationClick(station),
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-sm mb-1">{station.name}</h3>
                <p className="text-xs text-gray-600 mb-2">{station.address}</p>
                
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="font-medium">Network:</span>
                    <div className={`inline-block ml-1 px-2 py-1 rounded text-white text-xs ${
                      station.network === 'Tesla' ? 'bg-red-500' :
                      station.network === 'DEWA' ? 'bg-blue-500' :
                      station.network === 'ADDC' ? 'bg-green-500' :
                      station.network === 'SEWA' ? 'bg-purple-500' :
                      'bg-gray-500'
                    }`}>
                      {station.network}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className={`ml-1 ${station.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {station.isAvailable ? 'Available' : 'Occupied'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="font-medium">Max Power:</span> {station.maxPower} kW
                  </div>
                  <div>
                    <span className="font-medium">Ports:</span> {station.numberOfPorts}
                  </div>
                </div>

                <div className="text-xs mb-2">
                  <span className="font-medium">Connectors:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {station.connectorTypes.map((type, index) => (
                      <span key={index} className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                {station.costPerKwh && (
                  <div className="text-xs mb-2">
                    <span className="font-medium">Cost:</span> {station.costPerKwh} AED/kWh
                  </div>
                )}

                {station.amenities.length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium">Amenities:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {station.amenities.slice(0, 3).map((amenity, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                          {amenity}
                        </span>
                      ))}
                      {station.amenities.length > 3 && (
                        <span className="text-gray-500 text-xs">+{station.amenities.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Enhanced legend */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3">
        <h4 className="text-sm font-semibold mb-2 text-white">Charging Stations</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-white/80">Fast (150+ kW)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-white/80">Medium (50-149 kW)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-white/80">Slow (&lt;50 kW)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-white/80">Occupied</span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20">
          <div className="text-xs text-white/60">
            Showing {chargingStations.length} stations
            {loading && <span className="ml-1">(Loading...)</span>}
          </div>
        </div>
      </div>

      {/* Data source notice */}
      <div className="absolute bottom-4 right-4 bg-green-600/90 text-white text-xs px-2 py-1 rounded">
        Real Charging Data
      </div>
    </div>
  );
};

export default FreeMap;