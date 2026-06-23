import { supabase } from "@/integrations/supabase/client";
import { CarCardProps } from "../@types/data";
import { useState } from "react";
import { sweepExpiredCarUnavailability } from "@/lib/car-unavailability-sweep";

export async function useCarFetch( setCars: (cars: CarCardProps[]) => void, setLoading: (loading: boolean) => void ) {
     try {
          await sweepExpiredCarUnavailability();

          const { data, error } = await supabase
            .from('cars')
            .select('*')
            // .eq('is_available', true)
            .order('base_price_per_day', { ascending: true });
    
          if (error) throw error;
          console.log('booking list', data);
          setCars(data || []);
        } catch (error) {
          console.error('Error loading cars:', error);
        } finally {
          setLoading(false);
        }
}
