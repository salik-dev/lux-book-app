import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Mail, User as UserIcon, ShieldCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/pages/admin/schedule/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  AdminRole,
  AdminUser,
  ROLE_LABELS,
  createAdminUser,
  updateAdminUser,
} from './users/admin-users';

interface AdminUserFormData {
  username: string;
  email: string;
  role: AdminRole;
}

interface AdminUserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing user to edit; omit/null to create a new one. */
  user?: AdminUser | null;
  onSaved: (user: AdminUser) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fieldClass =
  'h-9 rounded-md border-gray-200 bg-[#fafafa] pl-10 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d] focus-visible:bg-white';

export function AdminUserSheet({ open, onOpenChange, user, onSaved }: AdminUserSheetProps) {
  const { toast } = useToast();
  const isEdit = !!user;
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<AdminUserFormData>({
    defaultValues: { username: '', email: '', role: 'admin' },
  });

  // Reset the form whenever the sheet opens (fresh create, or prefilled edit).
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    form.reset({
      username: user?.username ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'admin',
    });
  }, [open, user]);

  const onSubmit = async (values: AdminUserFormData) => {
    setSubmitting(true);
    setServerError(null);

    const payload = {
      username: values.username.trim(),
      email: values.email.trim().toLowerCase(),
      role: values.role,
    };

    const { data, error } = isEdit
      ? await updateAdminUser({ id: user!.id, ...payload })
      : await createAdminUser(payload);

    setSubmitting(false);

    if (error || !data?.user) {
      setServerError(error ?? 'Something went wrong. Please try again.');
      return;
    }

    toast({
      title: isEdit ? 'Admin updated' : 'Admin added',
      description: isEdit
        ? `${payload.username}'s details were saved.`
        : `${payload.username} can now sign in to the admin portal.`,
    });
    onSaved(data.user);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-white p-0 sm:max-w-[440px]">
        <SheetHeader className="shrink-0 border-b border-gray-100 px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e3c08d]/15">
              <ShieldCheck className="h-5 w-5 text-[#8b6b3e]" />
            </div>
            <div>
              <SheetTitle className="text-lg font-semibold text-gray-900">
                {isEdit ? 'Edit admin' : 'Add admin'}
              </SheetTitle>
              <SheetDescription className="text-sm text-gray-500">
                {isEdit
                  ? 'Update this admin user’s details.'
                  : 'Register a new admin who can sign in to the portal.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="sheet-scroll flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <FormField
                control={form.control}
                name="username"
                rules={{
                  required: 'Username is required',
                  minLength: { value: 2, message: 'Username must be at least 2 characters' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Username <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input placeholder="e.g. jane.doe" className={fieldClass} {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: 'Email is required',
                  pattern: { value: EMAIL_PATTERN, message: 'Enter a valid email address' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                          type="email"
                          autoComplete="off"
                          placeholder="name@company.com"
                          className={fieldClass}
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                rules={{ required: 'Role is required' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Role <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9 w-full rounded-md border-gray-200 bg-[#fafafa] focus-visible:ring-2 focus-visible:ring-[#e3c08d]/50 focus-visible:border-[#e3c08d]">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as AdminRole[]).map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      Admins manage day-to-day operations. Super admins can also manage users.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {serverError}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-gray-100 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                  className="rounded-md border-gray-200 bg-white text-gray-700 hover:cursor-pointer hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[#e3c08d] font-medium text-black hover:cursor-pointer hover:bg-[#d4b27f]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEdit ? 'Saving...' : 'Adding...'}
                    </>
                  ) : isEdit ? (
                    'Save changes'
                  ) : (
                    'Add admin'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
