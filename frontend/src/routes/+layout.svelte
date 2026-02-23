<script lang="ts">
  import '../app.css';
  import { authStore } from '$lib/stores/auth';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { logout as apiLogout, getUnreadMessageCount } from '$lib/api';
  import { onMount } from 'svelte';
  import { unreadCountStore } from '$lib/stores/inbox';
  import type { Snippet } from 'svelte';
  import ThreeBackground from '$lib/components/three/ThreeBackground.svelte';

  let { children }: { children: Snippet } = $props();

  let currentPath = $derived(page.url.pathname);

  let mobileMenuOpen = $state(false);
  let userMenuOpen = $state(false);

  let unreadCount = $derived($unreadCountStore);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  function toggleUserMenu() {
    userMenuOpen = !userMenuOpen;
  }

  function closeUserMenu() {
    userMenuOpen = false;
  }

  async function handleLogout() {
    await apiLogout();
    authStore.logout();
    closeMobileMenu();
    closeUserMenu();
    goto('/');
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (userMenuOpen && !target.closest('.user-menu-container')) {
      closeUserMenu();
    }
  }

  async function fetchUnreadCount() {
    if ($authStore.isAuthenticated) {
      const count = await getUnreadMessageCount();
      unreadCountStore.set(count);
    }
  }

  onMount(() => {
    fetchUnreadCount();
  });

  $effect(() => {
    if ($authStore.isAuthenticated) {
      fetchUnreadCount();
    } else {
      unreadCountStore.reset();
    }
  });
</script>

<svelte:window onclick={handleClickOutside} />

<ThreeBackground />
<div class="min-h-screen flex flex-col relative" style="z-index: 1;">
  <!-- Header -->
  <header class="bg-white border-b-4 border-black text-black sticky top-0 z-50">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <!-- Logo -->
        <a href="/" class="flex-shrink-0" onclick={closeMobileMenu}>
          <img src="/bidmo.to.png" alt="BidMo.to" class="h-10 w-auto" />
        </a>

        <!-- Desktop Navigation -->
        <div class="hidden md:flex md:space-x-1">
          <a
            href="/products"
            class="px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium transition-colors hover:bg-black hover:text-white {currentPath.startsWith('/products') ? 'bg-black text-white' : ''}"
          >
            Browse
          </a>
          <a
            href="/about-us"
            class="px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium transition-colors hover:bg-black hover:text-white {currentPath === '/about-us' ? 'bg-black text-white' : ''}"
          >
            About Us
          </a>
        </div>

        <!-- Desktop Actions -->
        <div class="hidden md:flex md:items-center md:space-x-2">
          {#if $authStore.isAuthenticated}
            <!-- Inbox Button -->
            <a
              href="/inbox"
              class="relative px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium transition-colors hover:bg-black hover:text-white {currentPath === '/inbox' ? 'bg-black text-white' : ''}"
              title="Inbox"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {#if unreadCount > 0}
                <span class="absolute -top-1 -right-1 bg-black text-white text-xs font-bold h-5 w-5 flex items-center justify-center font-mono">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              {/if}
            </a>

            <a
              href="/sell"
              class="px-4 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest font-semibold transition-colors hover:bg-white hover:text-black border-2 border-black {currentPath === '/sell' ? 'bg-white text-black' : ''}"
            >
              + Sell
            </a>

            <!-- User Menu Dropdown -->
            <div class="user-menu-container relative">
              <button
                onclick={(e: MouseEvent) => { e.stopPropagation(); toggleUserMenu(); }}
                class="flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest font-medium transition-colors hover:bg-black hover:text-white {userMenuOpen ? 'bg-black text-white' : ''}"
              >
                <span>{$authStore.user?.name || 'User'}</span>
                <svg class="w-4 h-4 transition-transform {userMenuOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {#if userMenuOpen}
                <div class="user-menu-dropdown absolute right-0 mt-0 w-48 bg-white border-2 border-black py-1 z-50">
                  <a
                    href="/dashboard"
                    onclick={closeUserMenu}
                    class="block px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors hover:bg-black hover:text-white {currentPath.startsWith('/dashboard') ? 'bg-black text-white' : ''}"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/profile"
                    onclick={closeUserMenu}
                    class="block px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors hover:bg-black hover:text-white {currentPath === '/profile' ? 'bg-black text-white' : ''}"
                  >
                    Profile
                  </a>
                  <div class="border-t-2 border-black my-1"></div>
                  <button
                    onclick={handleLogout}
                    class="w-full text-left px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors hover:bg-black hover:text-white underline"
                  >
                    Logout
                  </button>
                </div>
              {/if}
            </div>
          {:else}
            <a
              href="/login"
              class="px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium transition-colors hover:bg-black hover:text-white"
            >
              Login
            </a>
            <a
              href="/register"
              class="px-4 py-2 bg-black text-white border-2 border-black font-mono text-xs uppercase tracking-widest font-semibold transition-colors hover:bg-white hover:text-black"
            >
              Register
            </a>
          {/if}
        </div>

        <!-- Mobile menu button -->
        <button
          onclick={toggleMobileMenu}
          class="md:hidden inline-flex items-center justify-center p-2 hover:bg-black hover:text-white focus:outline-none border-2 border-black"
          aria-label="Toggle menu"
        >
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {#if mobileMenuOpen}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            {/if}
          </svg>
        </button>
      </div>

      <!-- Mobile Navigation -->
      {#if mobileMenuOpen}
        <div class="md:hidden pb-4 space-y-1 border-t-2 border-black pt-4">
          <a
            href="/products"
            onclick={closeMobileMenu}
            class="block px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white {currentPath.startsWith('/products') ? 'bg-black text-white' : ''}"
          >
            Browse
          </a>
          <a
            href="/about-us"
            onclick={closeMobileMenu}
            class="block px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white {currentPath === '/about-us' ? 'bg-black text-white' : ''}"
          >
            About Us
          </a>
          {#if $authStore.isAuthenticated}
            <a
              href="/inbox"
              onclick={closeMobileMenu}
              class="flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white mt-2 {currentPath === '/inbox' ? 'bg-black text-white' : ''}"
            >
              <div class="relative">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {#if unreadCount > 0}
                  <span class="absolute -top-2 -right-2 bg-black text-white text-xs font-bold h-5 w-5 flex items-center justify-center font-mono">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                {/if}
              </div>
              <span>Inbox</span>
            </a>

            <a
              href="/sell"
              onclick={closeMobileMenu}
              class="block px-3 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest font-semibold mt-2 border-2 border-black hover:bg-white hover:text-black {currentPath === '/sell' ? 'bg-white text-black' : ''}"
            >
              + Sell
            </a>

            <a
              href="/dashboard"
              onclick={closeMobileMenu}
              class="block px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white mt-2 {currentPath.startsWith('/dashboard') ? 'bg-black text-white' : ''}"
            >
              Dashboard
            </a>

            <a
              href="/profile"
              onclick={closeMobileMenu}
              class="block px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white mt-2 {currentPath === '/profile' ? 'bg-black text-white' : ''}"
            >
              Profile
            </a>

            <div class="pt-2 border-t-2 border-black mt-2">
              <div class="px-3 py-2 text-sm font-mono">
                {$authStore.user?.name || 'User'}
              </div>
              <button
                onclick={handleLogout}
                class="w-full text-left px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white underline"
              >
                Logout
              </button>
            </div>
          {:else}
            <a
              href="/login"
              onclick={closeMobileMenu}
              class="block px-3 py-2 font-mono text-xs uppercase tracking-widest font-medium hover:bg-black hover:text-white"
            >
              Login
            </a>
            <a
              href="/register"
              onclick={closeMobileMenu}
              class="block px-3 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest font-semibold mt-2 border-2 border-black hover:bg-white hover:text-black"
            >
              Register
            </a>
          {/if}
        </div>
      {/if}
    </nav>
  </header>

  <!-- Main Content -->
  <main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="border-t-4 border-black bg-white py-4 text-center text-black text-sm font-mono uppercase tracking-widest">
    <p>&copy; 2025 BidMo.to - Bid mo 'to!</p>
  </footer>
</div>
