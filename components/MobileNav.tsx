"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X, Search, Store, Smartphone, Watch, Headphones, Zap, Battery, Home } from "lucide-react";
import StoreSearch from "./storefront/StoreSearch";

interface MobileNavProps {
  bannerUrl?: string | null;
  faviconUrl?: string | null;
}

export default function MobileNav({ bannerUrl, faviconUrl }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Close sidebar on navigation (e.g., after a search)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOpen(false);
  }, [pathname, searchParams]);

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsOpen(true)}
          className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-lg hover:bg-accent text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} className="text-foreground" />
        </button>
        
        {/* Logo Link (Desktop & Mobile) */}
        <Link href="/" className="flex items-center gap-2">
          {bannerUrl ? (
            // next/image needs both dimensions fixed for fill — bannerUrl is
            // an arbitrary admin-uploaded image (no known aspect ratio), so
            // this bounds it to roughly the old h-6/h-7 w-auto footprint and
            // lets object-contain preserve the real aspect ratio inside that
            // box (letterboxed, not stretched or cropped) instead of guessing
            // a wrong width/height pair the browser would then distort to.
            <div className="relative h-6 sm:h-7 w-[120px] sm:w-[140px]">
              <Image
                src={bannerUrl}
                alt="GadgetBroo"
                fill
                sizes="140px"
                className="object-contain object-left dark:brightness-110"
              />
            </div>
          ) : (
            <h1 className="text-lg sm:text-xl font-bold tracking-wider text-foreground">
              G<span className="hidden sm:inline">ADGET</span>
              <span className="text-primary">B<span className="hidden sm:inline">ROO</span></span>
            </h1>
          )}
        </Link>
      </div>

      {/* Mobile Drawer */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-100 flex md:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="relative w-4/5 max-w-sm bg-background border-r border-border shadow-2xl h-full flex flex-col animate-in slide-in-from-left duration-300">
            <div className="flex items-center justify-between p-5 border-b border-border">
              {faviconUrl ? (
                // Same reasoning as the banner logo above — bounded box,
                // object-contain preserves the real aspect ratio.
                <div className="relative h-8 w-8">
                  <Image src={faviconUrl} alt="GB" fill sizes="32px" className="object-contain" />
                </div>
              ) : (
                <h2 className="text-lg font-bold text-foreground tracking-wider">
                  G<span className="text-blue-500">B</span>
                </h2>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md bg-accent"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              {/* Search */}
              <div className="mb-6">
                <StoreSearch />
              </div>

              {/* Links */}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Navigation</p>
                <Link 
                  href="/" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Home size={18} className="text-emerald-400" />
                  Home
                </Link>
                <Link 
                  href="/store" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Store size={18} className="text-blue-400" />
                  All Store
                </Link>
                <Link 
                  href="/store/category/chargers-and-adapters"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Zap size={18} className="text-amber-400" />
                  Chargers & Adapters
                </Link>
                <Link 
                  href="/store/category/mobile-cooler"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Smartphone size={18} className="text-emerald-400" />
                  Mobile Coolers
                </Link>
                <Link 
                  href="/store/category/smart-watch"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Watch size={18} className="text-purple-400" />
                  Smart Watches
                </Link>
                <Link 
                  href="/store/category/sounds-audio"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Headphones size={18} className="text-rose-400" />
                  Sounds & Audio
                </Link>
                <Link 
                  href="/store/category/power-bank"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  <Battery size={18} className="text-sky-400" />
                  Power Banks
                </Link>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
