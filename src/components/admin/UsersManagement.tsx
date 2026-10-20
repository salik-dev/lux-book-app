import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useAdminHeaderSlot } from '@/context/admin-header-slot';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AdminUserSheet } from './AdminUserSheet';
import { AdminTableSkeleton } from './AdminTableSkeleton';
import {
  AdminUser,
  ROLE_LABELS,
  deleteAdminUser,
  listAdminUsers,
} from './users/admin-users';

export const UsersManagement: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const headerSlot = useAdminHeaderSlot();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await listAdminUsers();
    if (error || !data) {
      setLoadError(error ?? 'Failed to load users.');
      setUsers([]);
    } else {
      setUsers(data.users);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.username ?? '').toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        ROLE_LABELS[u.role].toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const openCreate = () => {
    setEditingUser(null);
    setSheetOpen(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setSheetOpen(true);
  };

  const handleSaved = (saved: AdminUser) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === saved.id);
      return exists ? prev.map((u) => (u.id === saved.id ? saved : u)) : [saved, ...prev];
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteAdminUser(deleteTarget.id);
    setDeleting(false);

    if (error) {
      toast({ title: 'Could not delete', description: error, variant: 'destructive' });
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    toast({
      title: 'Admin removed',
      description: `${deleteTarget.username ?? deleteTarget.email} no longer has access.`,
    });
    setDeleteTarget(null);
  };

  const isSelf = (u: AdminUser) =>
    !!user?.email && u.email.toLowerCase() === user.email.toLowerCase();

  return (
    <>
      {headerSlot &&
        createPortal(
          <>
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-lg border-gray-200 bg-[#fafafa] pl-10 transition-colors duration-200 focus-visible:border-[#e3c08d] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50"
              />
            </div>
            <Button
              size="sm"
              onClick={openCreate}
              className="rounded-lg bg-[#e3c08d] font-medium text-black shadow-none transition-colors duration-300 hover:cursor-pointer hover:bg-[#d4b27f]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add admin
            </Button>
          </>,
          headerSlot
        )}

      {loading ? (
        <AdminTableSkeleton rows={6} columns={5} />
      ) : (
      <Card className="card-premium admin-fade-in flex min-h-0 flex-1 flex-col bg-white">
        <CardHeader className="shrink-0 px-5 py-4">
          <CardTitle className="text-lg">User Management</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 px-5 pb-5 pt-0">
          {loadError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldAlert className="h-8 w-8 text-red-400" />
              <p className="text-sm text-gray-600">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                className="rounded-lg border-gray-200 hover:cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden rounded-md border border-gray-200">
              <Table className="bg-white" containerClassName="h-full overflow-auto table-scroll">
                <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                  <TableRow className="border-gray-200 text-gray-500">
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const self = isSelf(u);
                    return (
                      <TableRow
                        key={u.id}
                        className="border-gray-200 transition-colors duration-300 hover:bg-[#f7efe3]"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3c08d]/20 text-sm font-semibold uppercase text-[#8b6b3e]">
                              {(u.username ?? u.email)[0]?.toUpperCase() ?? 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900">
                                {u.username ?? '—'}
                                {self && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{u.email}</span>
                        </TableCell>
                        <TableCell>
                          {u.role === 'super_admin' ? (
                            <Badge className="border-transparent bg-[#e3c08d] text-black hover:bg-[#e3c08d]">
                              <ShieldCheck className="mr-1 h-3 w-3" />
                              {ROLE_LABELS[u.role]}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-gray-200 text-gray-600">
                              {ROLE_LABELS[u.role]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-500">
                            {format(new Date(u.created_at), 'MMM dd, yyyy')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(u)}
                              className="h-8 w-8 p-0 text-gray-500 hover:cursor-pointer hover:bg-[#e3c08d]/20 hover:text-[#8b6b3e]"
                              aria-label={`Edit ${u.username ?? u.email}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(u)}
                              disabled={self}
                              title={self ? "You can't delete your own account" : undefined}
                              className="h-8 w-8 p-0 text-gray-500 hover:cursor-pointer hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Delete ${u.username ?? u.email}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!loadError && filteredUsers.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No users match your search.' : 'No admin users yet. Add your first one.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Add / Edit sheet */}
      <AdminUserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editingUser}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm rounded-xl border-0 bg-white p-6 shadow-xl sm:max-w-sm">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-base font-semibold text-gray-900">Delete admin user</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-gray-500">
              Remove{' '}
              <span className="font-medium text-gray-800">
                {deleteTarget?.username ?? deleteTarget?.email}
              </span>
              ? They will lose access to the admin portal. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-md border-gray-200 bg-white text-gray-700 hover:cursor-pointer hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-md bg-red-600 font-medium text-white hover:cursor-pointer hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
