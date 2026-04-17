import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import logo from '../assets/logo.png';

interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  name?: string;
  phone?: string;
}

export function AuthDialog({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<AuthFormData>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      phone: ''
    },
  });

  const onSubmit = async (data: AuthFormData) => {
    setLoading(true);
    try {
      if (isLogin) {
        const { user, error } = await signIn(data.email, data.password);
        console.log('user login', user)
        if (error) {
          toast({
            title: 'Error',
            description: "Invalid email or password! Please try again.",
            variant: 'destructive',
          });
          // setOpen(false);
          return;
        }
      } else {
        if (data.password !== data.confirmPassword) {
          console.log('Passwords do not match')
          toast({
            title: 'Error',
            description: 'Passwords do not match',
            variant: 'destructive',
          });
          return;
        }
        await signUp(data.email, data.password, {
          name: data.name,
          phone: data.phone,
        });
        setOpen(false);
        toast({
          title: 'Success',
          description: 'Account created! Check your email to confirm.',
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="top-0 right-0 left-auto h-screen w-full max-w-[440px] translate-x-0 translate-y-0 overflow-y-auto border-l border-[#334047] bg-[#232e33] p-0 text-[#b1bdc3] shadow-2xl data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:duration-300 data-[state=closed]:duration-200">
        <div className="p-4 sm:px-8 sm:pb-0">
          <span className="flex justify-center">
            <img src={logo} alt="Logo" className="h-40 w-40 object-contain p-2" />
          </span>
          <DialogHeader className="mb-2">
            <DialogTitle className="text-center text-2xl font-bold text-[#E3C08D]">
              {isLogin ? 'Welcome Back' : 'Create an Account'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-6">
              <div className="space-y-4">
                {/* {!isLogin && (
                  <>
                    <FormField
                      control={form.control}
                      name="name"
                      rules={{ required: 'Name is required' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Full Name <span className="text-red-500">*</span></FormLabel>
                          <div className="relative mt-1">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              placeholder="Enter your full name" 
                              {...field} 
                              className="pl-10 h-12 rounded-md border-gray-300"
                            />
                          </div>
                          <FormMessage className="text-red-500 text-xs mt-1" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      rules={{ required: 'Phone number is required' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></FormLabel>
                          <div className="relative mt-1">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              placeholder="Enter your phone number" 
                              {...field} 
                              className="pl-10 h-12 rounded-md border-gray-300 focus:ring-2 focus:ring-[#E3C08D] focus:border-[#E3C08D]"
                            />
                          </div>
                          <FormMessage className="text-red-500 text-xs mt-1" />
                        </FormItem>
                      )}
                    />
                  </>
                )} */}

                <FormField
                  control={form.control}
                  name="email"
                  rules={{
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-[#d0d9dd]">Email <span className="text-red-400">*</span></FormLabel>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9eabb1]" />
                        <Input
                          placeholder="Enter your email"
                          {...field}
                          className="h-9 rounded-md border border-[#46555d] bg-[#1b2529] pl-10 text-[#b1bdc3] placeholder:text-[#7d8a91] focus-visible:ring-1 focus-visible:ring-[#E3C08D]"
                        />
                      </div>
                      <FormMessage className="text-red-500 text-xs mt-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  rules={{
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel className="text-sm font-medium text-[#d0d9dd]">Password <span className="text-red-400">*</span></FormLabel>
                        {!isLogin && (
                          <span className="text-xs text-[#9eabb1]">
                            Min. 6 characters
                          </span>
                        )}
                      </div>
                      <div className="relative mt-1">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9eabb1]" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          {...field}
                          className="h-9 rounded-md border border-[#46555d] bg-[#1b2529] pl-10 text-[#b1bdc3] placeholder:text-[#7d8a91] focus-visible:ring-1 focus-visible:ring-[#E3C08D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9eabb1] hover:text-[#d0d9dd]"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <FormMessage className="text-red-500 text-xs mt-1" />
                    </FormItem>
                  )}
                />

                {!isLogin && (
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    rules={{
                      required: 'Please confirm your password',
                      validate: (value) =>
                        value === form.getValues('password') || 'Passwords do not match',
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9eabb1]" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Confirm Password"
                            {...field}
                            className="h-9 rounded-md border border-[#46555d] bg-[#1b2529] pl-10 pr-10 text-[#b1bdc3] placeholder:text-[#7d8a91] focus-visible:ring-1 focus-visible:ring-[#E3C08D]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9eabb1] hover:text-[#d0d9dd]"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <FormMessage className="text-red-500 text-xs mt-1" />
                      </FormItem>
                    )}
                  />
                )}

                {isLogin && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-sm text-[#E3C08D] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="h-9 w-full rounded-md bg-[#E3C08D] font-medium text-black hover:cursor-pointer hover:bg-[#d4b27f]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </Button>

              <div className="flex flex-col justify-center items-center">
                <p className="text-center text-sm text-[#9eabb1]">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                </p>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    form.reset();
                    setIsLogin(!isLogin);
                  }}
                  className="w-24 leading-6 font-medium text-[#E3C08D] hover:cursor-pointer hover:bg-transparent hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
