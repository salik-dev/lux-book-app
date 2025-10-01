import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Loader2 } from 'lucide-react';

interface Car {
  id?: string;
  name: string;
  model: string;
  brand: string;
  year: number;
  base_price_per_hour: number;
  base_price_per_day: number;
  included_km_per_day: number;
  extra_km_rate: number;
  description?: string;
  is_available: boolean;
}

interface CarFormDialogProps {
  car?: Car;
  onCarSaved: () => void;
  trigger?: React.ReactNode;
}

export const CarFormDialog: React.FC<CarFormDialogProps> = ({ 
  car, 
  onCarSaved,
  trigger 
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Car>({
    name: '',
    model: '',
    brand: '',
    year: new Date().getFullYear(),
    base_price_per_hour: 100,
    base_price_per_day: 800,
    included_km_per_day: 200,
    extra_km_rate: 5,
    description: '',
    is_available: true,
  });

  useEffect(() => {
    if (car) {
      setFormData({
        id: car.id,
        name: car.name,
        model: car.model,
        brand: car.brand,
        year: car.year,
        base_price_per_hour: car.base_price_per_hour,
        base_price_per_day: car.base_price_per_day,
        included_km_per_day: car.included_km_per_day,
        extra_km_rate: car.extra_km_rate,
        description: car.description || '',
        is_available: car.is_available,
      });
    }
  }, [car]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const carData = {
        name: formData.name,
        model: formData.model,
        brand: formData.brand,
        year: formData.year,
        base_price_per_hour: formData.base_price_per_hour,
        base_price_per_day: formData.base_price_per_day,
        included_km_per_day: formData.included_km_per_day,
        extra_km_rate: formData.extra_km_rate,
        description: formData.description,
        is_available: formData.is_available,
      };

      let error;
      
      if (car?.id) {
        // Update existing car
        ({ error } = await supabase
          .from('cars')
          .update(carData)
          .eq('id', car.id));
      } else {
        // Create new car
        ({ error } = await supabase
          .from('cars')
          .insert([carData]));
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Car ${car?.id ? 'updated' : 'created'} successfully`,
      });

      setOpen(false);
      onCarSaved();
      
      // Reset form if creating new car
      if (!car?.id) {
        setFormData({
          name: '',
          model: '',
          brand: '',
          year: new Date().getFullYear(),
          base_price_per_hour: 100,
          base_price_per_day: 800,
          included_km_per_day: 200,
          extra_km_rate: 5,
          description: '',
          is_available: true,
        });
      }
    } catch (error) {
      console.error('Error saving car:', error);
      toast({
        title: 'Error',
        description: `Failed to ${car?.id ? 'update' : 'create'} car`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof Car, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-fjord hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {car?.id ? 'Edit Vehicle' : 'Add New Vehicle'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vehicle Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., BMW X7 Luxury"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                placeholder="e.g., BMW"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                placeholder="e.g., X7"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                min="2010"
                max={new Date().getFullYear() + 1}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="base_price_per_hour">Price per Hour (NOK)</Label>
              <Input
                id="base_price_per_hour"
                type="number"
                value={formData.base_price_per_hour}
                onChange={(e) => handleInputChange('base_price_per_hour', parseFloat(e.target.value))}
                min="0"
                step="0.01"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="base_price_per_day">Price per Day (NOK)</Label>
              <Input
                id="base_price_per_day"
                type="number"
                value={formData.base_price_per_day}
                onChange={(e) => handleInputChange('base_price_per_day', parseFloat(e.target.value))}
                min="0"
                step="0.01"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="included_km_per_day">Included KM per Day</Label>
              <Input
                id="included_km_per_day"
                type="number"
                value={formData.included_km_per_day}
                onChange={(e) => handleInputChange('included_km_per_day', parseInt(e.target.value))}
                min="0"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="extra_km_rate">Extra KM Rate (NOK)</Label>
              <Input
                id="extra_km_rate"
                type="number"
                value={formData.extra_km_rate}
                onChange={(e) => handleInputChange('extra_km_rate', parseFloat(e.target.value))}
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Vehicle description and features..."
              rows={3}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="is_available"
              checked={formData.is_available}
              onCheckedChange={(checked) => handleInputChange('is_available', checked)}
            />
            <Label htmlFor="is_available">Available for booking</Label>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {car?.id ? 'Update Vehicle' : 'Add Vehicle'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};