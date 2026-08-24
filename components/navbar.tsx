
import Link from 'next/link';
import Image from 'next/image';
import { getServerSession } from '../helpers/get-servesession';
import prisma from '../lib/prisma';
import CartIcon from './storefront/CartIcon';
import { User as UserIcon, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';
import StoreSearch from './storefront/StoreSearch';
import LogoutButton from './logoutUser';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import MobileNav from './MobileNav';
import { ThemeToggle } from './ThemeToggle';

export default async function Navbar() {
  const session = await getServerSession();
  const user = session?.user;

  let fullUser = null;
  let hasAdminAccess = false;
  
  if (user?.id) {
    fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: { include: { permissions: true } } },
    });

    if (fullUser?.role) {
      if (fullUser.role.name.toLowerCase() === "admin") {
        hasAdminAccess = true;
      } else if (fullUser.role.permissions) {
        hasAdminAccess = fullUser.role.permissions.some(
          (p) => p.canView || p.canCreate || p.canUpdate || p.canDelete
        );
      }
    }
  }

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "global" }
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl shadow-sm">
      <div className="w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo and Mobile Nav */}
        {/* Logo and Mobile Nav */}
        <div className="flex items-center gap-6">
          <MobileNav bannerUrl={settings?.bannerUrl} faviconUrl={settings?.faviconUrl} />

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-foreground/80">
            <Link href="/store" className="hover:text-foreground transition-colors">Store</Link>
            <Link href="/store/category/mobile-cooler" className="hover:text-foreground transition-colors">Mobile Coolers</Link>
            <Link href="/store/category/chargers-and-adapters" className="hover:text-foreground transition-colors">Chargers & Adapters</Link>
            <Link href="/store/category/smart-watch" className="hover:text-foreground transition-colors">Smart Watches</Link>
            <Link href="/store/category/sounds-audio" className="hover:text-foreground transition-colors">Sounds & Audio</Link>
          </nav>
        </div>

        {/* Global Search Bar (Desktop) */}
        <div className="hidden md:block flex-1 max-w-xl mx-8">
          <StoreSearch />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <CartIcon />

          {!user ? (
            <div className="flex items-center gap-2 ml-2">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm" className="text-xs text-foreground/80 hover:text-foreground hover:bg-muted h-8">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm" className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground h-8 hidden sm:flex">
                  Sign Up
                </Button>
              </Link>
            </div>
          ) : (
            <div className="ml-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="relative flex items-center justify-center w-8 h-8 rounded-full bg-muted border border-border hover:ring-2 hover:ring-primary/50 outline-none transition-all">
                  {user.image ? (
                    // next/image — user.image is only ever set by better-auth
                    // from Google OAuth (see next.config.ts's googleusercontent.com
                    // remotePattern), never user- or admin-editable directly.
                    // object-cover here is deliberate, unlike product photos: a
                    // profile picture cropped to fill a circle is the expected,
                    // standard avatar treatment, not a "hidden content" bug.
                    <Image
                      src={user.image}
                      alt={user.name || "User"}
                      fill
                      sizes="32px"
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon size={16} className="text-muted-foreground" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border text-card-foreground">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />

                  {hasAdminAccess && (
                    <DropdownMenuItem asChild className="hover:bg-muted cursor-pointer focus:bg-muted">
                      <Link href="/admin" className="flex items-center gap-2">
                        <LayoutDashboard size={14} className="text-primary" />
                        {fullUser?.role?.name?.toLowerCase() === 'admin' 
                          ? 'Admin Dashboard' 
                          : `${(fullUser?.role?.name || '').charAt(0).toUpperCase() + (fullUser?.role?.name || '').slice(1)} Dashboard`}
                      </Link>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem asChild className="hover:bg-muted cursor-pointer focus:bg-muted">
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <UserIcon size={14} />
                      My Profile
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-border" />
                  <div className="p-1">
                    <LogoutButton />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
