import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Edit, Trash2, Image, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CarFormDialog } from './CarFormDialog';
import { getCarPlaceholder } from '@/utils/carPlaceholder';

interface Car {
  id: string;
  name: string;
  model: string;
  brand: string;
  year: number;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number | null;
  extra_km_rate: number | null;
  image_url?: string | null;
  is_available: boolean | null;  // Make this nullable
  created_at: string;
}

export const CarsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingImages, setGeneratingImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCars();
  }, []);

  const loadCars = async () => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCars(data || []);
    } catch (error) {
      console.error('Error loading cars:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cars',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCarImage = async (car: Car) => {
    setGeneratingImages(prev => new Set(prev).add(car.id));
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-car-images', {
        body: {
          carId: car.id,
          carName: car.name,
          brand: car.brand,
          model: car.model,
          year: car.year,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Car image generated successfully',
      });

      // Reload cars to get updated image URL
      loadCars();
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate car image',
        variant: 'destructive',
      });
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(car.id);
        return newSet;
      });
    }
  };

  const toggleCarAvailability = async (carId: string, isAvailable: boolean) => {
    try {
      const { error } = await supabase
        .from('cars')
        .update({ is_available: !isAvailable })
        .eq('id', carId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Car ${!isAvailable ? 'enabled' : 'disabled'} successfully`,
      });

      loadCars();
    } catch (error) {
      console.error('Error updating car:', error);
      toast({
        title: 'Error',
        description: 'Failed to update car availability',
        variant: 'destructive',
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('no-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const filteredCars = cars.filter(car =>
    car.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    car.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    car.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Card className="card-premium">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-premium">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Fleet Management</span>
          <CarFormDialog onCarSaved={loadCars} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Cars Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Specifications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCars.map((car) => (
                <TableRow key={car.id}>
                  <TableCell>
                    <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={car.image_url || getCarPlaceholder(car.brand, car.model, car.name)}
                        alt={car.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{car.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {car.brand} {car.model} ({car.year})
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{formatPrice(car.base_price_per_day)}/day</div>
                      <div className="text-muted-foreground">{formatPrice(car.base_price_per_hour)}/hour</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{car.included_km_per_day} km/day</div>
                      <div className="text-muted-foreground">
                        +{formatPrice((car.extra_km_rate ?? 0) as number)}/km
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={car.is_available 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                      }
                    >
                      {car.is_available ? 'Available' : 'Unavailable'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => generateCarImage(car)}
                        disabled={generatingImages.has(car.id)}
                      >
                        {generatingImages.has(car.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Image className="h-4 w-4" />
                        )}
                      </Button>
                      <CarFormDialog 
                        car={car}
                        onCarSaved={loadCars}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleCarAvailability(car.id, car.is_available || false)}
                      >
                        {car.is_available ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredCars.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No vehicles found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};