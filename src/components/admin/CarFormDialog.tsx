import React, { useState, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, X, Lock } from 'lucide-react';
import { VehicleRegistrationLookup } from '@/components/admin/VehicleRegistrationLookup';
import { formatPlate, type VehicleLookupResult } from '@/lib/vehicle-lookup-api';

/** Postgres unique_violation (cars.registration_number). */
const UNIQUE_VIOLATION = '23505';
// Generate a unique filename using timestamp and random number
const generateUniqueId = () => {
  return `img_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
};


import { Car } from '@/types/car';

type BasicField = 'name' | 'brand' | 'model' | 'year';

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
  // Adding and editing both require verifying the vehicle against the Statens vegvesen register
  // first. The verified (normalised) plate is what gets saved as `registration_number`.
  const [verifiedPlate, setVerifiedPlate] = useState<string | null>(null);
  const [autofilled, setAutofilled] = useState<Partial<Pick<Car, BasicField>> | null>(null);
  const [lookupKey, setLookupKey] = useState(0);
  const verified = verifiedPlate !== null;
  const locked = !verified;
  const [formData, setFormData] = useState<Car>({
    name: car?.name || "",
    model: car?.model || "",
    brand: car?.brand || "",
    year: car?.year || new Date().getFullYear(),
    base_price_per_hour: car?.base_price_per_hour || 0,
    base_price_per_day: car?.base_price_per_day || 0,
    base_price_per_month: car?.base_price_per_month ?? 0,
    deposit_amount: car?.deposit_amount || 0,
    included_km_per_day: car?.included_km_per_day || 0,
    extra_km_rate: car?.extra_km_rate || 0,
    description: car?.description || "",
    image_url: car?.image_url || "",
    is_available: car?.is_available ?? true,
  });

  const toFormData = (source: Car): Car => ({
    id: source.id,
    name: source.name,
    model: source.model,
    brand: source.brand,
    year: source.year,
    base_price_per_hour: source.base_price_per_hour,
    base_price_per_day: source.base_price_per_day,
    base_price_per_month: source.base_price_per_month ?? 0,
    deposit_amount: source.deposit_amount || 0,
    included_km_per_day: source.included_km_per_day,
    extra_km_rate: source.extra_km_rate,
    description: source.description || '',
    image_url: source.image_url || '',
    is_available: source.is_available,
    registration_number: source.registration_number ?? null,
  });

  useEffect(() => {
    if (car) setFormData(toFormData(car));
  }, [car]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Every open starts from a fresh, locked lookup.
      setVerifiedPlate(null);
      setAutofilled(null);
      setLookupKey((k) => k + 1);
      // Editing: drop unsaved changes (including register values) so reopening shows the saved car.
      if (car) setFormData(toFormData(car));
    }
  };

  const handleVehicleVerified = ({ vehicle }: VehicleLookupResult) => {
    // Year is only locked when the register actually has one; otherwise the admin enters it.
    const filled: Partial<Pick<Car, BasicField>> = {
      name: vehicle.name,
      brand: vehicle.brand,
      model: vehicle.model,
      ...(vehicle.year !== null ? { year: vehicle.year } : {}),
    };
    setFormData((prev) => ({ ...prev, ...filled }));
    setAutofilled(filled);
    setVerifiedPlate(vehicle.registrationNumber);
  };

  /** Register-verified values can't be edited; change the plate to look up another car. */
  const isFromRegister = (field: BasicField) => verified && autofilled?.[field] !== undefined;

  const autofilledHint = (field: BasicField) =>
    isFromRegister(field) && (
      <span className="lux-fade-in ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
        <Lock className="h-2.5 w-2.5" />
        From register
      </span>
    );

  const basicFieldClass = (field: BasicField) =>
    isFromRegister(field)
      ? `${fieldClass} bg-emerald-50/60 border-emerald-300 text-gray-700 cursor-not-allowed focus-visible:ring-0 focus-visible:border-emerald-300`
      : fieldClass;

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
    if (locked) return;
    setLoading(true);

    try {
      const carData = {
        name: formData.name,
        model: formData.model,
        brand: formData.brand,
        year: formData.year,
        base_price_per_hour: formData.base_price_per_hour,
        base_price_per_day: formData.base_price_per_day,
        // Optional: store null when not offered per month so the per-month option stays hidden.
        base_price_per_month:
          formData.base_price_per_month && formData.base_price_per_month > 0
            ? formData.base_price_per_month
            : null,
        deposit_amount: formData.deposit_amount ?? 0,
        included_km_per_day: formData.included_km_per_day,
        extra_km_rate: formData.extra_km_rate,
        description: formData.description,
        image_url: formData.image_url,
        is_available: formData.is_available,
        registration_number: verifiedPlate,
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

      if (error?.code === UNIQUE_VIOLATION) {
        // Another admin saved a car with this plate after our lookup.
        toast({
          title: 'Already in your fleet',
          description: `${formatPlate(verifiedPlate ?? '')} was just added to another vehicle. Each vehicle can only be added once.`,
          variant: 'destructive',
        });
        return;
      }
      if (error) throw error;

      toast({
        title: 'Success',
        description: `Car ${car?.id ? 'updated' : 'created'} successfully`,
      });

      handleOpenChange(false);
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
          base_price_per_month: 0,
          deposit_amount: 0,
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

  const fieldClass =
    'bg-white rounded-lg border-gray-300 h-8 text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d]';
  const sectionLabelClass = 'text-xs font-bold uppercase tracking-wide text-gray-500';
  const fieldLabelClass = 'text-[11px] font-semibold text-gray-500';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        {trigger || (
          <Button className="rounded-lg bg-[#e3c08d] text-white hover:bg-[#e3c08d]/80 hover:cursor-pointer transition-colors duration-500">
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        )}
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay data-booking-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

        <DialogPrimitive.Content
          data-booking-sheet
          className="fixed right-0 top-0 z-50 flex w-full max-w-[640px] flex-col bg-white"
          style={{ height: '100dvh', boxShadow: '-2px 0 40px rgba(0,0,0,0.18)' }}
        >
          {/* Header */}
          <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
            <div>
              <DialogPrimitive.Title className="text-[17px] font-bold text-gray-900 leading-tight">
                {car?.id ? 'Edit Vehicle' : 'Add New Vehicle'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-xs text-gray-400">
                {car?.id
                  ? 'Verify the registration number, then update the details.'
                  : 'Verify the registration number, then complete the details.'}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                className="shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col">
          <div className="sheet-scroll flex-1 min-h-0 overflow-y-auto px-6 py-4">
            <VehicleRegistrationLookup
              key={lookupKey}
              carId={car?.id}
              initialRegistrationNumber={car?.registration_number}
              onVerified={handleVehicleVerified}
              onInvalidated={() => setVerifiedPlate(null)}
            />

            {locked && (
              <p className="lux-fade-in mt-4 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                <Lock className="h-3 w-3 shrink-0" />
                Search a registration number above to unlock the rest of the form.
              </p>
            )}

            <fieldset
              disabled={locked}
              aria-disabled={locked}
              className={`min-w-0 transition-[opacity,filter] duration-500 ease-out pt-4 ${locked ? 'pointer-events-none select-none opacity-40 grayscale' : 'opacity-100'}`}
            >
            {/* Image Upload */}
            <div className="space-y-2 pb-4 border-b border-gray-100">
              <Label className={sectionLabelClass}>Car Image</Label>
              {formData.image_url ? (
                <div className="relative group">
                  <img
                    src={formData.image_url}
                    alt={formData.name || 'Car image'}
                    className="h-36 w-full object-cover rounded-lg border border-gray-200"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
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
                    className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 transition-colors duration-300 hover:bg-gray-100 hover:border-[#e3c08d] ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center pt-3 pb-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#e3c08d] mb-1.5"></div>
                        <p className="text-xs text-gray-500">Uploading...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-3 pb-3">
                        <svg
                          className="w-6 h-6 mb-1.5 text-gray-400"
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
                        <p className="text-xs text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-[11px] text-gray-400">
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

            {/* Basic information */}
            <div className="space-y-3 py-4 border-b border-gray-100">
              <Label className={sectionLabelClass}>Basic information</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="name" className={fieldLabelClass}>Vehicle Name <span className="text-red-500">*</span>{autofilledHint('name')}</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., BMW X7 Luxury"
                    required
                    readOnly={isFromRegister('name')}
                    className={basicFieldClass('name')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="brand" className={fieldLabelClass}>Brand <span className="text-red-500">*</span>{autofilledHint('brand')}</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('brand', e.target.value)}
                    placeholder="e.g., BMW"
                    required
                    readOnly={isFromRegister('brand')}
                    className={basicFieldClass('brand')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="model" className={fieldLabelClass}>Model <span className="text-red-500">*</span>{autofilledHint('model')}</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    placeholder="e.g., X7"
                    required
                    readOnly={isFromRegister('model')}
                    className={basicFieldClass('model')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="year" className={fieldLabelClass}>Year <span className="text-red-500">*</span>{autofilledHint('year')}</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                    min="2010"
                    max={new Date().getFullYear() + 1}
                    required
                    readOnly={isFromRegister('year')}
                    className={basicFieldClass('year')}
                  />
                </div>
              </div>
            </div>

            {/* Pricing & policy */}
            <div className="space-y-3 py-4 border-b border-gray-100">
              <Label className={sectionLabelClass}>Pricing &amp; policy</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="base_price_per_hour" className={fieldLabelClass}>Price per Hour (NOK) <span className="text-red-500">*</span></Label>
                  <Input
                    id="base_price_per_hour"
                    type="number"
                    value={formData.base_price_per_hour}
                    onChange={(e) => handleInputChange('base_price_per_hour', parseFloat(e.target.value))}
                    min="0"
                    step="0.01"
                    required
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="base_price_per_day" className={fieldLabelClass}>Price per Day (NOK) <span className="text-red-500">*</span></Label>
                  <Input
                    id="base_price_per_day"
                    type="number"
                    value={formData.base_price_per_day}
                    onChange={(e) => handleInputChange('base_price_per_day', parseFloat(e.target.value))}
                    min="0"
                    step="0.01"
                    required
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="base_price_per_month" className={fieldLabelClass}>Price per Month (NOK)</Label>
                  <Input
                    id="base_price_per_month"
                    type="number"
                    value={formData.base_price_per_month ?? 0}
                    onChange={(e) => handleInputChange('base_price_per_month', e.target.value ? parseFloat(e.target.value) : 0)}
                    min="0"
                    step="0.01"
                    placeholder="Leave 0 if not offered per month"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="deposit_amount" className={fieldLabelClass}>Deposit Amount (NOK)</Label>
                  <Input
                    id="deposit_amount"
                    type="number"
                    value={formData.deposit_amount ?? 0}
                    onChange={(e) =>
                      handleInputChange(
                        'deposit_amount',
                        e.target.value ? parseFloat(e.target.value) : 0
                      )
                    }
                    min="0"
                    step="0.01"
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="included_km_per_day" className={fieldLabelClass}>Included KM per Day <span className="text-red-500">*</span></Label>
                  <Input
                    id="included_km_per_day"
                    type="number"
                    value={formData.included_km_per_day ?? ''}
                    onChange={(e) => handleInputChange('included_km_per_day', e.target.value ? parseInt(e.target.value) : null)}
                    min="0"
                    required
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="extra_km_rate" className={fieldLabelClass}>Extra KM Rate (NOK) <span className="text-red-500">*</span></Label>
                  <Input
                    id="extra_km_rate"
                    type="number"
                    value={formData.extra_km_rate ?? ''}
                    onChange={(e) => handleInputChange('extra_km_rate', e.target.value ? parseFloat(e.target.value) : null)}
                    min="0"
                    step="0.01"
                    required
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5 py-4 border-b border-gray-100">
              <Label htmlFor="description" className={sectionLabelClass}>
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Vehicle description and features..."
                rows={3}
                className="bg-white rounded-lg border-gray-300 text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d] focus-visible:ring-offset-0"
              />
            </div>

            {/* Availability */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <Label htmlFor="is_available" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Available for booking
                </Label>
                <p className="text-[11px] text-gray-500">Toggle off to hide this vehicle from customers.</p>
              </div>
              <Switch
                id="is_available"
                checked={formData.is_available ?? false}
                onCheckedChange={(checked) => handleInputChange('is_available', checked)}
                className="h-5 w-9 hover:cursor-pointer transition-colors duration-300 data-[state=checked]:bg-[#e3c08d] data-[state=unchecked]:bg-gray-300"
              />
            </div>
            </fieldset>
          </div>

          <div className="shrink-0 flex justify-end gap-3 px-6 py-3 border-t border-gray-100 bg-white">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className='rounded-lg border border-gray-300 bg-white text-gray-700 shadow-none hover:cursor-pointer hover:bg-gray-100 hover:text-gray-700 transition-colors duration-300 dark:bg-white dark:text-gray-700 dark:border-gray-300 dark:hover:bg-gray-100 dark:hover:text-gray-700'
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || locked}
              title={locked ? 'Verify the registration number first' : undefined}
              className='bg-[#e3c08d] text-black hover:bg-[#e3c08d]/80 hover:cursor-pointer transition-all duration-300 rounded-lg shadow-sm disabled:cursor-not-allowed'
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {car?.id ? 'Update Vehicle' : 'Add Vehicle'}
            </Button>
          </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
