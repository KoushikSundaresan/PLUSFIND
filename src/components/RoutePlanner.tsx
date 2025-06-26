import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EVModel, RoutePlan } from '@/types/ev';
import { Navigation, Battery, Clock, Zap, MapPin, AlertTriangle } from 'lucide-react';
import { dynamicRouteCalculationService } from '@/services/dynamicRouteCalculationService';
import { freeRoutingService } from '@/services/freeRoutingService';

interface RoutePlannerProps {
  selectedModel?: EVModel;
  onPlanRoute: (routeData: RoutePlan) => void;
}

const RoutePlanner: React.FC<RoutePlannerProps> = ({ selectedModel, onPlanRoute }) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [currentSOC, setCurrentSOC] = useState([75]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlanRoute = async () => {
    if (!selectedModel || !origin || !destination) return;

    setIsPlanning(true);
    setError(null);
    
    try {
      // Geocode origin and destination
      const [originResults, destinationResults] = await Promise.all([
        freeRoutingService.geocode(origin),
        freeRoutingService.geocode(destination)
      ]);

      if (originResults.length === 0) {
        throw new Error('Origin location not found');
      }
      if (destinationResults.length === 0) {
        throw new Error('Destination location not found');
      }

      const originPoint = {
        lat: originResults[0].lat,
        lng: originResults[0].lon
      };

      const destinationPoint = {
        lat: destinationResults[0].lat,
        lng: destinationResults[0].lon
      };

      // Calculate optimal route with real data
      const routePlan = await dynamicRouteCalculationService.calculateOptimalRoute(
        originPoint,
        destinationPoint,
        selectedModel,
        currentSOC[0]
      );

      // Update addresses with geocoded results
      routePlan.origin.address = originResults[0].display_name;
      routePlan.destination.address = destinationResults[0].display_name;

      onPlanRoute(routePlan);
      
    } catch (error) {
      console.error('Route planning error:', error);
      setError(error instanceof Error ? error.message : 'Failed to plan route');
    } finally {
      setIsPlanning(false);
    }
  };

  const maxRange = selectedModel 
    ? Math.round((selectedModel.batteryCapacity * 1000 * (currentSOC[0] / 100)) / selectedModel.efficiency)
    : 0;

  const isLowSOC = currentSOC[0] < 20;
  const isVeryLowSOC = currentSOC[0] < 10;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-primary" />
          Plan Your Route
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">From</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter starting location (e.g., Dubai Mall)"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">To</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter destination (e.g., Abu Dhabi Mall)"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Current State of Charge</label>
            <div className="flex items-center gap-2">
              <Battery className={`w-4 h-4 ${isVeryLowSOC ? 'text-red-500' : isLowSOC ? 'text-yellow-500' : 'text-primary'}`} />
              <span className={`text-sm font-mono ${isVeryLowSOC ? 'text-red-500' : isLowSOC ? 'text-yellow-500' : ''}`}>
                {currentSOC[0]}%
              </span>
            </div>
          </div>
          
          <div className="px-1">
            <Slider
              value={currentSOC}
              onValueChange={setCurrentSOC}
              max={100}
              min={5}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>5%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {isLowSOC && (
            <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-700">
                {isVeryLowSOC ? 'Critical battery level! Find charging immediately.' : 'Low battery level. Consider charging soon.'}
              </span>
            </div>
          )}

          {selectedModel && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available Range:</span>
                <span className={`font-medium ${isLowSOC ? 'text-yellow-600' : 'text-primary'}`}>
                  {maxRange} km
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Available Energy:</span>
                <span className="font-medium">
                  {((selectedModel.batteryCapacity * currentSOC[0]) / 100).toFixed(1)} kWh
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Efficiency:</span>
                <span className="font-medium">{selectedModel.efficiency} Wh/km</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <Button 
          onClick={handlePlanRoute}
          disabled={!selectedModel || !origin || !destination || isPlanning}
          className="w-full gradient-electric"
          size="lg"
        >
          {isPlanning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Calculating Route...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Plan Optimal Route
            </>
          )}
        </Button>

        {!selectedModel && (
          <p className="text-xs text-muted-foreground text-center">
            Please select an EV model first to plan your route
          </p>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Route calculation includes elevation, weather, and traffic</p>
          <p>• Charging stops optimized for time and availability</p>
          <p>• Real-time charging station data from multiple networks</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RoutePlanner;