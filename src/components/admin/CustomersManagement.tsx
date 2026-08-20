import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAdminHeaderSlot } from '@/context/admin-header-slot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Search, Download, ChevronsRight, ChevronRight, ChevronLeft, ChevronsLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
  date_of_birth?: string | null;
  created_at: string;
  user_id?: string | null;
  bookings?: Array<{ id: string }>;
}

export const CustomersManagement: React.FC = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          bookings:bookings(id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load customers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

   // Add these calculations before the return statement
   const totalItems = filteredCustomers.length;
   const totalPages = Math.ceil(totalItems / itemsPerPage);
   const startIndex = (currentPage - 1) * itemsPerPage;
   const currentItems = filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
 
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
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const headerSlot = useAdminHeaderSlot();

  return (
    <>
      {headerSlot && createPortal(
        <>
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg border-gray-200 bg-[#fafafa] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d] focus-visible:bg-white"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg border border-gray-200 bg-white text-gray-700 shadow-none hover:cursor-pointer hover:bg-[#e3c08d] hover:text-black transition-colors duration-300 dark:bg-white dark:text-gray-700 dark:border-gray-200 dark:hover:bg-[#e3c08d] dark:hover:text-black"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </>,
        headerSlot
      )}
    <Card className="card-premium bg-white flex flex-1 min-h-0 flex-col">
      <CardHeader className="px-5 py-4 shrink-0">
        <CardTitle className="text-lg">Customer Management</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col space-y-4 px-5 pb-5 pt-0">
        {/* Customers Table */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-gray-200">
          <Table className="bg-white rounded-lg" containerClassName="h-full overflow-auto table-scroll">
            <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <TableRow className="text-gray-500 border-gray-200">
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Bookings</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.map((customer) => (
                <TableRow key={customer.id} className='hover:bg-[#f7efe3] transition-colors duration-300 border-gray-200'>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{customer.full_name}</div>
                      {customer.date_of_birth && (
                        <div className="text-xs text-gray-500 leading-tight">
                          Born {format(new Date(customer.date_of_birth), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs leading-tight space-y-0.5">
                      <div>{customer.email}</div>
                      <div className="text-gray-500">{customer.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs leading-tight space-y-0.5">
                      <div>{customer.address}</div>
                      <div className="text-gray-500">
                        {customer.postal_code} {customer.city}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-center">
                      <div className="font-medium text-sm">{customer.bookings?.length || 0}</div>
                      <div className="text-xs text-gray-500">bookings</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-gray-500">
                      {format(new Date(customer.created_at), 'MMM dd, yyyy')}
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

        {filteredCustomers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No customers found matching your criteria.</p>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  );
};