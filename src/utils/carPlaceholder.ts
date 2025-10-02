import placeholderSUV from '@/assets/placeholder-suv.webp';
import placeholderSedan from '@/assets/placeholder-sedan.webp';
import placeholderSports from '@/assets/placeholder-sports.webp';
import placeholderCrossover from '@/assets/placeholder-crossover.webp';

export const getCarPlaceholder = (brand: string, model: string, name: string): string => {
  const carInfo = `${brand} ${model} ${name}`.toLowerCase();
  
  // Sports cars
  if (carInfo.includes('911') || carInfo.includes('sport') || carInfo.includes('rs ') || carInfo.includes('amg') || carInfo.includes('m50')) {
    return placeholderSports;
  }
  
  // SUVs and large vehicles
  if (carInfo.includes('x7') || carInfo.includes('cayenne') || carInfo.includes('range rover') || carInfo.includes('q8')) {
    return placeholderSUV;
  }
  
  // Crossovers and smaller SUVs
  if (carInfo.includes('evoque') || carInfo.includes('crossover')) {
    return placeholderCrossover;
  }
  
  // Default to sedan for luxury cars like A8, S-Class
  return placeholderSedan;
};