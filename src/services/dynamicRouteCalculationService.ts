import { EVModel, RoutePlan, RouteSegment, ChargingStation, WeatherData } from '@/types/ev';
import { realChargingStationService } from './realChargingStationService';
import { freeWeatherService } from './freeWeatherService';

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number;
}

interface ElevationData {
  elevation: number;
  distance: number;
}

export class DynamicRouteCalculationService {
  private readonly elevationApiUrl = 'https://api.open-elevation.com/api/v1/lookup';

  async calculateOptimalRoute(
    origin: RoutePoint,
    destination: RoutePoint,
    vehicle: EVModel,
    initialSOC: number,
    weatherData?: WeatherData
  ): Promise<RoutePlan> {
    try {
      // Get elevation profile for the route
      const elevationProfile = await this.getElevationProfile(origin, destination);
      
      // Get weather data if not provided
      const weather = weatherData || await freeWeatherService.getCurrentWeather(
        (origin.lat + destination.lat) / 2,
        (origin.lng + destination.lng) / 2
      );

      // Calculate route segments with realistic energy consumption
      const segments = await this.calculateRouteSegments(
        origin, 
        destination, 
        vehicle, 
        elevationProfile, 
        weather
      );

      // Find optimal charging stops
      const chargingStops = await this.findOptimalChargingStops(
        segments,
        vehicle,
        initialSOC
      );

      // Calculate totals
      const totalDistance = segments.reduce((sum, seg) => sum + seg.distance, 0);
      const totalDrivingTime = segments.reduce((sum, seg) => sum + seg.duration, 0);
      const totalChargingTime = chargingStops.reduce((sum, stop) => sum + stop.chargingTime, 0);
      const totalEnergyUsed = segments.reduce((sum, seg) => sum + seg.energyRequired, 0);
      
      // Calculate final SOC
      const energyAdded = chargingStops.reduce((sum, stop) => sum + stop.energyAdded, 0);
      const finalSOC = Math.max(0, initialSOC - (totalEnergyUsed / vehicle.batteryCapacity * 100) + (energyAdded / vehicle.batteryCapacity * 100));

      return {
        id: `route-${Date.now()}`,
        origin: { ...origin, address: 'Origin' },
        destination: { ...destination, address: 'Destination' },
        vehicle,
        initialSOC,
        segments,
        chargingStops,
        totalDistance: Math.round(totalDistance),
        totalDuration: Math.round(totalDrivingTime + totalChargingTime),
        totalEnergyUsed: Math.round(totalEnergyUsed * 10) / 10,
        finalSOC: Math.round(finalSOC),
        weatherImpact: this.calculateWeatherImpact(weather)
      };
    } catch (error) {
      console.error('Route calculation error:', error);
      throw new Error('Failed to calculate optimal route');
    }
  }

  private async getElevationProfile(origin: RoutePoint, destination: RoutePoint): Promise<ElevationData[]> {
    try {
      // Create intermediate points for elevation profile
      const points = this.interpolateRoutePoints(origin, destination, 10);
      
      const response = await fetch(this.elevationApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: points.map(p => ({ latitude: p.lat, longitude: p.lng }))
        })
      });

      if (!response.ok) {
        throw new Error('Elevation API failed');
      }

      const data = await response.json();
      
      return data.results.map((result: any, index: number) => ({
        elevation: result.elevation || 0,
        distance: index * (this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng) / points.length)
      }));
    } catch (error) {
      console.warn('Using flat elevation profile due to API error:', error);
      // Fallback to flat profile
      const distance = this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
      return [
        { elevation: 50, distance: 0 },
        { elevation: 50, distance: distance }
      ];
    }
  }

  private interpolateRoutePoints(start: RoutePoint, end: RoutePoint, numPoints: number): RoutePoint[] {
    const points: RoutePoint[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;
      points.push({
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio
      });
    }
    
    return points;
  }

  private async calculateRouteSegments(
    origin: RoutePoint,
    destination: RoutePoint,
    vehicle: EVModel,
    elevationProfile: ElevationData[],
    weather: WeatherData
  ): Promise<RouteSegment[]> {
    const totalDistance = this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    
    // For simplicity, create one main segment (in real implementation, you'd use routing API)
    const elevationGain = this.calculateElevationGain(elevationProfile);
    const energyRequired = this.calculateEnergyConsumption(
      totalDistance,
      elevationGain,
      vehicle,
      weather
    );
    
    // Estimate driving time based on road type and conditions
    const averageSpeed = this.estimateAverageSpeed(totalDistance, weather);
    const duration = (totalDistance / averageSpeed) * 60; // minutes

    return [{
      startLat: origin.lat,
      startLng: origin.lng,
      endLat: destination.lat,
      endLng: destination.lng,
      distance: totalDistance,
      duration: Math.round(duration),
      elevationGain,
      energyRequired: Math.round(energyRequired * 10) / 10
    }];
  }

  private calculateElevationGain(elevationProfile: ElevationData[]): number {
    let totalGain = 0;
    
    for (let i = 1; i < elevationProfile.length; i++) {
      const gain = elevationProfile[i].elevation - elevationProfile[i-1].elevation;
      if (gain > 0) {
        totalGain += gain;
      }
    }
    
    return Math.round(totalGain);
  }

  private calculateEnergyConsumption(
    distance: number,
    elevationGain: number,
    vehicle: EVModel,
    weather: WeatherData
  ): number {
    // Base consumption from vehicle efficiency
    let baseConsumption = (distance * vehicle.efficiency) / 1000; // kWh
    
    // Elevation impact (approximately 0.1 kWh per 100m elevation gain per 1000kg)
    const elevationImpact = (elevationGain / 100) * (vehicle.mass / 1000) * 0.1;
    
    // Weather impact
    const weatherMultiplier = this.getWeatherMultiplier(weather, vehicle);
    
    // Air resistance impact (simplified)
    const airResistanceImpact = this.calculateAirResistanceImpact(distance, vehicle, weather);
    
    const totalConsumption = (baseConsumption + elevationImpact + airResistanceImpact) * weatherMultiplier;
    
    return Math.max(0, totalConsumption);
  }

  private getWeatherMultiplier(weather: WeatherData, vehicle: EVModel): number {
    let multiplier = 1.0;
    
    // Temperature impact
    if (weather.temperature < 0) {
      multiplier += 0.3; // Cold weather significantly increases consumption
    } else if (weather.temperature < 10) {
      multiplier += 0.15;
    } else if (weather.temperature > 35) {
      multiplier += 0.1; // Hot weather increases AC usage
    }
    
    // Wind impact (simplified - assumes headwind)
    const windImpact = Math.min(0.2, weather.windSpeed / 100);
    multiplier += windImpact;
    
    return multiplier;
  }

  private calculateAirResistanceImpact(distance: number, vehicle: EVModel, weather: WeatherData): number {
    // Simplified air resistance calculation
    const averageSpeed = 80; // km/h assumption for highway driving
    const airDensity = 1.225; // kg/m³ at sea level
    
    // Power required to overcome air resistance (simplified)
    const dragForce = 0.5 * airDensity * vehicle.dragCoefficient * vehicle.frontalArea * Math.pow(averageSpeed / 3.6, 2);
    const powerRequired = dragForce * (averageSpeed / 3.6) / 1000; // kW
    
    // Energy for the distance
    const timeHours = distance / averageSpeed;
    return powerRequired * timeHours * 0.1; // Factor for efficiency losses
  }

  private estimateAverageSpeed(distance: number, weather: WeatherData): number {
    let baseSpeed = 80; // km/h for highway
    
    if (distance < 50) {
      baseSpeed = 60; // City driving
    } else if (distance < 200) {
      baseSpeed = 70; // Mixed driving
    }
    
    // Weather impact on speed
    if (weather.condition.toLowerCase().includes('rain') || 
        weather.condition.toLowerCase().includes('storm')) {
      baseSpeed *= 0.8;
    }
    
    if (weather.windSpeed > 50) {
      baseSpeed *= 0.9;
    }
    
    return Math.max(30, baseSpeed);
  }

  private async findOptimalChargingStops(
    segments: RouteSegment[],
    vehicle: EVModel,
    initialSOC: number
  ): Promise<RoutePlan['chargingStops']> {
    const chargingStops: RoutePlan['chargingStops'] = [];
    let currentSOC = initialSOC;
    let currentPosition = { lat: segments[0].startLat, lng: segments[0].startLng };
    
    for (const segment of segments) {
      // Calculate energy needed for this segment
      const energyNeeded = segment.energyRequired;
      const socNeeded = (energyNeeded / vehicle.batteryCapacity) * 100;
      
      // Check if we need to charge before this segment
      if (currentSOC - socNeeded < 20) { // Keep 20% buffer
        // Find charging stations near current position
        const nearbyStations = await realChargingStationService.getNearbyStations({
          lat: currentPosition.lat,
          lng: currentPosition.lng,
          radiusKm: 50,
          connectorTypes: vehicle.chargingPorts.map(port => port.type)
        });
        
        // Find best station (available, compatible, high power)
        const bestStation = this.findBestChargingStation(nearbyStations.stations, vehicle);
        
        if (bestStation) {
          // Calculate charging session
          const targetSOC = 80; // Charge to 80% for optimal speed
          const energyToAdd = vehicle.batteryCapacity * (targetSOC - currentSOC) / 100;
          const chargingPower = Math.min(
            bestStation.maxPower,
            vehicle.maxChargingSpeed
          );
          const chargingTime = (energyToAdd / chargingPower) * 60; // minutes
          
          chargingStops.push({
            station: bestStation,
            arrivalSOC: Math.round(currentSOC),
            departureSOC: targetSOC,
            chargingTime: Math.round(chargingTime),
            energyAdded: Math.round(energyToAdd * 10) / 10
          });
          
          currentSOC = targetSOC;
        }
      }
      
      // Update position and SOC after segment
      currentPosition = { lat: segment.endLat, lng: segment.endLng };
      currentSOC -= socNeeded;
    }
    
    return chargingStops;
  }

  private findBestChargingStation(stations: ChargingStation[], vehicle: EVModel): ChargingStation | null {
    const compatibleStations = stations.filter(station => {
      const hasCompatibleConnector = station.connectorTypes.some(type =>
        vehicle.chargingPorts.some(port => port.type === type)
      );
      return station.isAvailable && hasCompatibleConnector;
    });
    
    if (compatibleStations.length === 0) return null;
    
    // Score stations based on power, network reliability, and availability
    return compatibleStations.reduce((best, current) => {
      const currentScore = this.scoreChargingStation(current);
      const bestScore = this.scoreChargingStation(best);
      return currentScore > bestScore ? current : best;
    });
  }

  private scoreChargingStation(station: ChargingStation): number {
    let score = 0;
    
    // Power rating (higher is better)
    score += station.maxPower / 10;
    
    // Network reliability
    if (station.network === 'Tesla') score += 20;
    else if (station.network === 'DEWA') score += 15;
    else if (station.network === 'ADDC') score += 10;
    
    // Number of ports (more options)
    score += station.numberOfPorts;
    
    // Amenities
    score += station.amenities.length;
    
    return score;
  }

  private calculateWeatherImpact(weather: WeatherData): number {
    let impact = 0;
    
    if (weather.temperature < 0) impact -= 30;
    else if (weather.temperature < 10) impact -= 15;
    else if (weather.temperature > 35) impact -= 10;
    
    if (weather.windSpeed > 30) impact -= 5;
    
    return Math.max(-40, Math.min(10, impact));
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

export const dynamicRouteCalculationService = new DynamicRouteCalculationService();