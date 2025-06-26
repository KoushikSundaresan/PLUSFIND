import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FreeMap from '@/components/FreeMap';
import EVSelector from '@/components/EVSelector';
import RoutePlanner from '@/components/RoutePlanner';
import RouteResults from '@/components/RouteResults';
import ApiKeyConfig from '@/components/ApiKeyConfig';
import { EVModel, ChargingStation, RoutePlan } from '@/types/ev';
import { useToast } from '@/hooks/use-toast';
import { Zap, MapPin } from 'lucide-react';

const Index = () => {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<EVModel | undefined>();
  const [selectedStation, setSelectedStation] = useState<ChargingStation | undefined>();
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);

  const handleStationSelect = (station: ChargingStation) => {
    setSelectedStation(station);
  };

  const handlePlanRoute = (plan: RoutePlan) => {
    setRoutePlan(plan);
    
    // Show success toast with route summary
    toast({
      title: "Route Calculated! 🗺️",
      description: `${plan.totalDistance}km trip with ${plan.chargingStops.length} charging stop${plan.chargingStops.length !== 1 ? 's' : ''}`,
      duration: 5000,
    });
  };

  const handleStartNavigation = () => {
    if (!routePlan) return;
    
    try {
      // Create Google Maps URL with optimized waypoints
      const origin = `${routePlan.origin.lat},${routePlan.origin.lng}`;
      const destination = `${routePlan.destination.lat},${routePlan.destination.lng}`;
      
      let mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(routePlan.origin.address)}&destination=${encodeURIComponent(routePlan.destination.address)}&travelmode=driving`;
      
      // Add charging stops as waypoints
      if (routePlan.chargingStops.length > 0) {
        const waypoints = routePlan.chargingStops
          .map(stop => `${stop.station.lat},${stop.station.lng}`)
          .join('|');
        mapsUrl += `&waypoints=${waypoints}`;
      }
      
      // Show detailed navigation toast
      toast({
        title: "Navigation Started! 🚗",
        description: `Opening Google Maps with ${routePlan.chargingStops.length} optimized charging stop${routePlan.chargingStops.length !== 1 ? 's' : ''}. Total time: ${Math.floor(routePlan.totalDuration / 60)}h ${routePlan.totalDuration % 60}m`,
        duration: 5000,
      });
      
      // Open Google Maps in a new tab
      window.open(mapsUrl, '_blank');
      
    } catch (error) {
      console.error('Navigation error:', error);
      toast({
        title: "Navigation Error",
        description: "Could not open Google Maps. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  Plusfind
                </h1>
                <p className="text-sm text-muted-foreground">UAE EV Route Planner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                Real Data
              </Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                Dynamic Routing
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          {/* Left Panel - Controls */}
          <div className="space-y-6 overflow-y-auto max-h-full">
            <ApiKeyConfig />
            
            <EVSelector
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
            />

            <RoutePlanner
              selectedModel={selectedModel}
              onPlanRoute={handlePlanRoute}
            />

            {routePlan && (
              <RouteResults
                routePlan={routePlan}
                onStartNavigation={handleStartNavigation}
              />
            )}
          </div>

          {/* Center Panel - Map */}
          <div className="lg:col-span-2">
            <FreeMap
              onStationSelect={handleStationSelect}
              className="h-full w-full"
            />
          </div>
        </div>

        {/* Selected Station Info */}
        {selectedStation && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-full max-w-md px-4 lg:px-0">
            <Card className="bg-black/80 backdrop-blur-sm border-border/50 animate-slide-up">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white">
                  <MapPin className="w-5 h-5 text-primary" />
                  {selectedStation.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-white/70">{selectedStation.address}</p>
                
                <div className="flex items-center gap-4">
                  <Badge 
                    variant={selectedStation.isAvailable ? "default" : "destructive"}
                    className={selectedStation.isAvailable ? "bg-green-500" : ""}
                  >
                    {selectedStation.isAvailable ? 'Available' : 'Occupied'}
                  </Badge>
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    {selectedStation.network}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50">Max Power</p>
                    <p className="text-white font-medium">{selectedStation.maxPower} kW</p>
                  </div>
                  <div>
                    <p className="text-white/50">Ports Available</p>
                    <p className="text-white font-medium">{selectedStation.numberOfPorts}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50">Connectors</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedStation.connectorTypes.slice(0, 2).map((type, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-white/50">Cost</p>
                    <p className="text-white font-medium">
                      {selectedStation.costPerKwh ? `${selectedStation.costPerKwh} AED/kWh` : 'N/A'}
                    </p>
                  </div>
                </div>

                {selectedStation.amenities.length > 0 && (
                  <div>
                    <p className="text-white/50 text-sm mb-1">Amenities</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedStation.amenities.slice(0, 3).map((amenity, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                      {selectedStation.amenities.length > 3 && (
                        <span className="text-white/50 text-xs">+{selectedStation.amenities.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;