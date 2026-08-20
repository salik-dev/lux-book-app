import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminHeaderSlot } from '@/context/admin-header-slot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Edit, Trash2, Image, Loader2, ChevronRight, ChevronsRight, ChevronLeft, ChevronsLeft } from 'lucide-react';
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
  deposit_amount: number | null;
  included_km_per_day: number | null;
  extra_km_rate: number | null;
  image_url?: string | null;
  is_available: boolean | null;  // Make this nullable
  created_at: string;
}

export const CarsManagement: React.FC = () => {
  const { toast } = useToast();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCars();
  }, []);

  const loadCars = async () => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('supabase cars', data);

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

  const toggleCarAvailability = async (carId: string, isAvailable: boolean) => {
    // Optimistic update so the switch flips instantly instead of waiting on the round-trip.
    setCars(prev => prev.map(c => (c.id === carId ? { ...c, is_available: !isAvailable } : c)));

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
    } catch (error) {
      console.error('Error updating car:', error);
      // Roll back on failure.
      setCars(prev => prev.map(c => (c.id === carId ? { ...c, is_available: isAvailable } : c)));
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

  // Add these calculations before the return statement
  const totalItems = filteredCars.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredCars.slice(startIndex, startIndex + itemsPerPage);

  // Add this function to handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

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

  const headerSlot = useAdminHeaderSlot();

  return (
    <TooltipProvider>
    {headerSlot && createPortal(
      <>
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-lg border-gray-200 bg-[#fafafa] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d] focus-visible:bg-white"
          />
        </div>
        <CarFormDialog onCarSaved={loadCars} />
      </>,
      headerSlot
    )}
    <Card className="card-premium bg-white flex flex-1 min-h-0 flex-col">
      <CardHeader className="px-5 py-4 shrink-0">
        <CardTitle className="text-lg">Fleet Management</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col space-y-4 px-5 pb-5 pt-0">

        {/* Cars Table */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-gray-200">
          <Table className='bg-white rounded-lg' containerClassName="h-full overflow-auto table-scroll">
            <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <TableRow className="text-gray-500 border-gray-200">
                <TableHead>Image</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Specifications</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.map((car) => (
                <TableRow key={car.id} className='hover:bg-[#f7efe3] transition-colors duration-300 border-gray-200'>
                  <TableCell>
                    <div className="relative w-14 h-10 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={car.image_url || getCarPlaceholder(car.brand, car.model, car.name)}
                        alt={car.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{car.name}</div>
                      <div className="text-xs text-gray-500 leading-tight">
                        {car.brand} {car.model} ({car.year})
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs leading-tight space-y-0.5">
                      <div className="font-medium text-gray-900">{formatPrice(car.base_price_per_day)}/day</div>
                      <div className="text-gray-500">{formatPrice(car.base_price_per_hour)}/hour</div>
                      <div className="text-gray-500">Deposit: {formatPrice(car.deposit_amount ?? 0)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs leading-tight space-y-0.5">
                      <div>{car.included_km_per_day} km/day</div>
                      <div className="text-gray-500">
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
                      <CarFormDialog
                        car={car}
                        onCarSaved={loadCars}
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Switch
                              checked={car.is_available ?? false}
                              onCheckedChange={() => toggleCarAvailability(car.id, car.is_available || false)}
                              className="hover:cursor-pointer transition-colors duration-300 data-[state=checked]:bg-[#e3c08d] data-[state=unchecked]:bg-gray-300"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{car.is_available ? 'Disable this vehicle' : 'Enable this vehicle'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Rendering */}
        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t bg-white rounded-b-lg border-gray-200">
            <div className="text-sm text-gray-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} bookings
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = currentPage <= 3
                    ? i + 1
                    : currentPage >= totalPages - 2
                      ? totalPages - 4 + i
                      : currentPage - 2 + i;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={`h-8 w-8 p-0 border border-gray-300 rounded-lg hover:cursor-pointer ${currentPage === page ? 'bg-[#e3c08d] text-white' : 'bg-white text-gray-700 shadow-none hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700'}`}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0 border border-gray-300 bg-white text-gray-700 shadow-none rounded-lg hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {filteredCars.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No vehicles found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
    </TooltipProvider>
  );
};