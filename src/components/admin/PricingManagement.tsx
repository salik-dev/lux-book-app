import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PricingRule {
  id: string;
  name: string;
  rule_type: string;
  zone_name?: string;
  min_distance_km?: number;
  max_distance_km?: number;
  price_per_km?: number;
  flat_fee?: number;
  is_active: boolean;
  created_at: string;
}

interface AppSetting {
  id: string;
  key: string;
  value: any;
  description?: string;
}

export const PricingManagement: React.FC = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [appSettings, setAppSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSettings, setEditingSettings] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      // Load pricing rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('pricing_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (rulesError) throw rulesError;

      // Load app settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('app_settings')
        .select('*')
        .order('key', { ascending: true });

      if (settingsError) throw settingsError;

      setPricingRules(rulesData || []);
      setAppSettings(settingsData || []);

      // Initialize editing state
      const editingState: { [key: string]: any } = {};
      settingsData?.forEach(setting => {
        editingState[setting.key] = setting.value;
      });
      setEditingSettings(editingState);

    } catch (error) {
      console.error('Error loading pricing data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pricing data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ value })
        .eq('key', key);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Setting updated successfully',
      });

      loadPricingData();
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to update setting',
        variant: 'destructive',
      });
    }
  };

  const togglePricingRule = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('pricing_rules')
        .update({ is_active: !isActive })
        .eq('id', ruleId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Pricing rule ${!isActive ? 'enabled' : 'disabled'} successfully`,
      });

      loadPricingData();
    } catch (error) {
      console.error('Error updating pricing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update pricing rule',
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

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="card-premium">
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-12 bg-muted rounded" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* App Settings */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {appSettings.map((setting) => (
              <div key={setting.id} className="space-y-2">
                <Label htmlFor={setting.key} className="text-sm font-medium">
                  {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Label>
                <p className="text-xs text-muted-foreground">{setting.description}</p>
                <div className="flex items-center gap-2">
                  <Input
                    id={setting.key}
                    type="number"
                    step="0.01"
                    value={editingSettings[setting.key] || ''}
                    onChange={(e) => setEditingSettings(prev => ({
                      ...prev,
                      [setting.key]: e.target.value
                    }))}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => updateSetting(setting.key, editingSettings[setting.key])}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delivery Zones */}
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Delivery Pricing Rules</span>
            <Button className="bg-gradient-fjord hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Distance Range</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricingRules.filter(rule => rule.rule_type === 'delivery_zone').map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>{rule.zone_name}</TableCell>
                    <TableCell>
                      {rule.min_distance_km || 0} - {rule.max_distance_km} km
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {rule.price_per_km && rule.price_per_km > 0 && (
                          <div>{formatPrice(rule.price_per_km)}/km</div>
                        )}
                        {rule.flat_fee && rule.flat_fee > 0 && (
                          <div>{formatPrice(rule.flat_fee)} flat fee</div>
                        )}
                        {(!rule.price_per_km || rule.price_per_km === 0) && 
                         (!rule.flat_fee || rule.flat_fee === 0) && (
                          <div className="text-green-600">Free</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => togglePricingRule(rule.id, rule.is_active)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pricingRules.filter(rule => rule.rule_type === 'delivery_zone').length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No delivery pricing rules configured.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};