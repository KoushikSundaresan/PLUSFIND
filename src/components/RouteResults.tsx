import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RoutePlan } from '@/types/ev';
import { 
  Navigation, 
  Clock, 
  Battery, 
  Zap, 
  MapPin, 
  Thermometer,
  Wind,
  TrendingUp,
  Mountain,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface RouteResultsProps {
  routePlan: RoutePlan;
  onStartNavigation?: () => void;
}

const RouteResults: React.FC<RouteResultsProps> = ({ routePlan, onStartNavigation }) => {
  if (!routePlan) return null;

  const drivingTime = routePlan.segments.reduce((sum, seg) => sum + seg.duration, 0);
  const chargingTime = routePlan.chargingStops.reduce((sum, stop) => sum + stop.chargingTime, 0);
  const totalElevationGain = routePlan.segments.reduce((sum, seg) => sum + seg.elevationGain, 0);

  const isLongTrip = routePlan.totalDistance > 300;
  const needsCharging = routePlan.chargingStops.length > 0;
  const lowFinalSOC = routePlan.finalSOC < 20;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Route Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-primary" />
            Route Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-medium">{routePlan.totalDistance} km</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total Time:</span>
                <span className="font-medium">{Math.floor(routePlan.totalDuration / 60)}h {routePlan.totalDuration % 60}m</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mountain className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Elevation:</span>
                <span className="font-medium">+{totalElevationGain}m</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Energy Used:</span>
                <span className="font-medium">{routePlan.totalEnergyUsed} kWh</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Battery className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Final SOC:</span>
                <span className={`font-medium ${lowFinalSOC ? 'text-red-600' : 'text-primary'}`}>
                  {routePlan.finalSOC}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Efficiency:</span>
                <span className="font-medium">
                  {(routePlan.totalEnergyUsed / routePlan.totalDistance * 100).toFixed(1)} kWh/100km
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Time Breakdown */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Time Breakdown</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Driving:</span>
                <span className="font-medium">{Math.floor(drivingTime / 60)}h {drivingTime % 60}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charging:</span>
                <span className="font-medium">{Math.floor(chargingTime / 60)}h {chargingTime % 60}m</span>
              </div>
            </div>
          </div>

          {/* Charging Stops */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Charging Stops Required</p>
              <p className="text-xs text-muted-foreground">
                {routePlan.chargingStops.length} stop{routePlan.chargingStops.length !== 1 ? 's' : ''} recommended
                {needsCharging && (
                  <> &middot; Total charging time: <span className="font-semibold">{Math.floor(chargingTime / 60)}h {chargingTime % 60}m</span></>
                )}
              </p>
            </div>
            <Badge variant="secondary" className="text-lg font-mono">
              {routePlan.chargingStops.length}
            </Badge>
          </div>

          {/* Warnings */}
          {(lowFinalSOC || isLongTrip) && (
            <div className="space-y-2">
              {lowFinalSOC && (
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-yellow-700">
                    Low final battery level. Consider adding a charging stop near destination.
                  </span>
                </div>
              )}
              {isLongTrip && (
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-blue-700">
                    Long trip detected. Route optimized for comfort and efficiency.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charging Stops Detail */}
      {routePlan.chargingStops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Charging Stops
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {routePlan.chargingStops.map((stop, index) => (
              <div key={index} className="p-3 bg-muted/30 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">{stop.station.name}</h4>
                    <p className="text-xs text-muted-foreground">{stop.station.address}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Stop {index + 1}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arrival SOC:</span>
                      <span className="font-medium">{stop.arrivalSOC}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Departure SOC:</span>
                      <span className="font-medium">{stop.departureSOC}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Charging Time:</span>
                      <span className="font-medium">{stop.chargingTime} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Energy Added:</span>
                      <span className="font-medium">{stop.energyAdded} kWh</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {stop.station.network}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stop.station.maxPower} kW
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {stop.station.numberOfPorts} ports
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Weather & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-primary" />
            Conditions Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <span className="text-sm">Temperature</span>
              <Badge variant="outline" className="text-xs">Optimal</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-blue-400" />
              <span className="text-sm">Wind Conditions</span>
              <Badge variant="outline" className="text-xs">Moderate</Badge>
            </div>
          </div>
          <div className="mt-3 p-2 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">
              Weather impact: <span className={`font-medium ${routePlan.weatherImpact < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {routePlan.weatherImpact > 0 ? '+' : ''}{routePlan.weatherImpact}%
              </span> efficiency change
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Start Navigation Button */}
      <Button 
        onClick={onStartNavigation}
        className="w-full gradient-electric"
        size="lg"
      >
        <Navigation className="w-4 h-4 mr-2" />
        Start Navigation
      </Button>
    </div>
  );
};

export default RouteResults;