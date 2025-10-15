import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
// Generate a unique filename using timestamp and random number
const generateUniqueId = () => {
  return `img_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};


import { Car } from '@/types/car';

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
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Car>({
    name: car?.name || "",
    model: car?.model || "",
    brand: car?.brand || "",
    year: car?.year || new Date().getFullYear(),
    base_price_per_hour: car?.base_price_per_hour || 0,
    base_price_per_day: car?.base_price_per_day || 0,
    included_km_per_day: car?.included_km_per_day || 0,
    extra_km_rate: car?.extra_km_rate || 0,
    description: car?.description || "",
    image_url: car?.image_url || "",
    is_available: car?.is_available ?? true,
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
        image_url: car.image_url || '',
        is_available: car.is_available,
      });
    }
  }, [car]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a valid image file (JPEG, PNG, SVG, or WebP)',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${generateUniqueId()}.${fileExt}`;
      const filePath = `cars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('car-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('car-images')
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        image_url: publicUrl
      }));

    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error uploading image',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!formData.image_url) return;
    
    try {
      // Extract the file path from the URL
      const url = new URL(formData.image_url);
      const filePath = url.pathname.split('/').pop();
      
      if (!filePath) return;

      const { error } = await supabase.storage
        .from('car-images')
        .remove([`cars/${filePath}`]);

      if (error) throw error;

      setFormData(prev => ({
        ...prev,
        image_url: ''
      }));

    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove image. Please try again.',
        variant: 'destructive',
      });
    }
  };

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
        image_url: formData.image_url,
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
          description: '',
          base_price_per_hour: 100,
          base_price_per_day: 800,
          included_km_per_day: 200,
          extra_km_rate: 5,
          image_url: '',
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
      <DialogTrigger asChild className="rounded-lg border-gray-200 bg-[#e3c08d] hover:bg-[#e3c08d]/80 hover:cursor-pointer transition-colors duration-500">
        {trigger || (
          <Button className="">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white rounded-lg border-gray-200">
        <DialogHeader>
          <DialogTitle>
            {car?.id ? 'Edit Vehicle' : 'Add New Vehicle'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Car Image</Label>
              {formData.image_url ? (
                <div className="relative group">
                  <img
                    src={formData.image_url}
                    alt={formData.name || 'Car image'}
                    className="h-48 w-full object-cover rounded-md border border-gray-700"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={handleRemoveImage}
                    disabled={isUploading}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="image-upload"
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#e3c08d] mb-2"></div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg
                          className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400"
                          aria-hidden="true"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 20 16"
                        >
                          <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                          />
                        </svg>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          PNG, JPG, SVG, or WEBP (MAX. 5MB)
                        </p>
                      </div>
                    )}
                    <input
                      id="image-upload"
                      name="image-upload"
                      type="file"
                      className="hidden"
                      accept="image/jpeg, image/png, image/svg+xml, image/webp"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Vehicle Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="e.g., BMW X7 Luxury"
                  required
                  className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand <span className="text-red-500">*</span></Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('brand', e.target.value)}
                  placeholder="e.g., BMW"
                  required
                  className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
                />
              </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model <span className="text-red-500">*</span></Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                placeholder="e.g., X7"
                required
                className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year <span className="text-red-500">*</span></Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                min="2010"
                max={new Date().getFullYear() + 1}
                required
                className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_price_per_hour">Price per Hour (NOK) <span className="text-red-500">*</span></Label>
              <Input
                id="base_price_per_hour"
                type="number"
                value={formData.base_price_per_hour}
                onChange={(e) => handleInputChange('base_price_per_hour', parseFloat(e.target.value))}
                min="0"
                step="0.01"
                required
                className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_price_per_day">Price per Day (NOK) <span className="text-red-500">*</span></Label>
              <Input
                id="base_price_per_day"
                type="number"
                value={formData.base_price_per_day}
                onChange={(e) => handleInputChange('base_price_per_day', parseFloat(e.target.value))}
                min="0"
                step="0.01"
                required
                className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="included_km_per_day">Included KM per Day <span className="text-red-500">*</span></Label>
              <Input
                id="included_km_per_day"
                type="number"
                value={formData.included_km_per_day ?? ''}
                onChange={(e) => handleInputChange('included_km_per_day', e.target.value ? parseInt(e.target.value) : null)}
                min="0"
                required
                className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra_km_rate">Extra KM Rate (NOK) <span className="text-red-500">*</span></Label>
              <Input
                id="extra_km_rate"
                type="number"
                value={formData.extra_km_rate ?? ''}
                onChange={(e) => handleInputChange('extra_km_rate', e.target.value ? parseFloat(e.target.value) : null)}
                min="0"
                step="0.01"
                required
                className="bg-[#fafafa] rounded-lg border-gray-200 h-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Vehicle description and features..."
              rows={3}
              className="bg-[#fafafa] rounded-lg border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-gray-400"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_available"
              checked={formData.is_available ?? false}
              onCheckedChange={(checked) => handleInputChange('is_available', checked)}
              className="h-5 w-9 hover:cursor-pointer data-[state=checked]:bg-[#e3c08d] data-[state=unchecked]:bg-gray-200"
            />
            <Label htmlFor="is_available" className="text-sm font-medium text-gray-700 ml-2 cursor-pointer">
              Available for booking
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className='rounded-lg border-gray-200 hover:cursor-pointer hover:bg-gray-100'
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className='bg-[#e3c08d] hover:bg-[#e3c08d]/80 hover:cursor-pointer transition-colors duration-500 rounded-lg'>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {car?.id ? 'Update Vehicle' : 'Add Vehicle'}
            </Button>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};