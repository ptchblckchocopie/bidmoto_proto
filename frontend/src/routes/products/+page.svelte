<script lang="ts">
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth';
  import { regions, getCitiesByRegion } from '$lib/data/philippineLocations';
  import ThreeHero from '$lib/components/three/ThreeHero.svelte';

  let { data } = $props<{ data: PageData }>();

  let countdowns: { [key: string]: string } = $state({});
  let countdownInterval: ReturnType<typeof setInterval> | null = $state(null);
  let userBids: { [productId: string]: number } = $state({}); // Maps product ID to user's bid amount
  let userBidsByProduct: { [productId: string]: any[] } = $state({}); // All user bids per product

  // Local state for form inputs
  let searchInput = $state(data.search || '');
  let regionInput = $state(data.region || '');
  let cityInput = $state(data.city || '');
  let searchTimeout: ReturnType<typeof setTimeout> | null = $state(null);
  let lastDataSearch = $state(data.search || ''); // Track last known data.search value
  let lastDataRegion = $state(data.region || '');
  let lastDataCity = $state(data.city || '');

  // Items per page options
  const itemsPerPageOptions = [12, 24, 48, 96];

  // Get cities for selected region
  let availableCities = $derived(regionInput ? getCitiesByRegion(regionInput) : []);

  // Reset city when region changes
  $effect(() => {
    if (regionInput && !availableCities.includes(cityInput)) {
      // Don't auto-clear if we're loading from URL params
      const urlCity = page.url.searchParams.get('city') || '';
      if (cityInput && cityInput !== urlCity) {
        cityInput = '';
      }
    }
  });

  function updateURL(params: Record<string, string | number>) {
    const url = new URL(page.url);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value.toString());
      } else {
        url.searchParams.delete(key);
      }
    });
    goto(url.toString(), { keepFocus: true, noScroll: false });
  }

  function handleSearchInput() {
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      updateURL({
        search: searchInput,
        region: regionInput,
        city: cityInput,
        page: '1', // Reset to page 1 on new search
        status: data.status,
        limit: data.limit.toString()
      });
    }, 500); // Debounce for 500ms
  }

  function handleLocationInput() {
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      updateURL({
        search: searchInput,
        region: regionInput,
        city: cityInput,
        page: '1', // Reset to page 1 on location change
        status: data.status,
        limit: data.limit.toString()
      });
    }, 500); // Debounce for 500ms
  }

  function clearFilters() {
    searchInput = '';
    regionInput = '';
    cityInput = '';
    updateURL({
      search: '',
      region: '',
      city: '',
      page: '1',
      status: data.status,
      limit: data.limit.toString()
    });
  }

  function changeTab(status: string) {
    updateURL({
      status,
      page: '1', // Reset to page 1 on tab change
      search: searchInput,
      region: regionInput,
      city: cityInput,
      limit: data.limit.toString()
    });

    // Scroll to products section after a small delay to allow URL update
    setTimeout(() => {
      const productsSection = document.getElementById('products-section');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  function goToPage(pageNum: number) {
    updateURL({
      page: pageNum.toString(),
      status: data.status,
      search: searchInput,
      region: regionInput,
      city: cityInput,
      limit: data.limit.toString()
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeItemsPerPage(limit: number) {
    updateURL({
      limit: limit.toString(),
      page: '1', // Reset to page 1 when changing items per page
      status: data.status,
      search: searchInput,
      region: regionInput,
      city: cityInput
    });
  }

  // Update local search input when data changes (e.g., browser back/forward)
  // Only update if data.search has actually changed and is different from current input
  $effect(() => {
    const currentDataSearch = data.search || '';
    if (currentDataSearch !== lastDataSearch) {
      // data.search changed - only update input if it's different from what user typed
      if (currentDataSearch !== searchInput) {
        searchInput = currentDataSearch;
      }
      lastDataSearch = currentDataSearch;
    }
  });

  // Update local location inputs when data changes
  $effect(() => {
    const currentDataRegion = data.region || '';
    if (currentDataRegion !== lastDataRegion) {
      if (currentDataRegion !== regionInput) {
        regionInput = currentDataRegion;
      }
      lastDataRegion = currentDataRegion;
    }
  });

  $effect(() => {
    const currentDataCity = data.city || '';
    if (currentDataCity !== lastDataCity) {
      if (currentDataCity !== cityInput) {
        cityInput = currentDataCity;
      }
      lastDataCity = currentDataCity;
    }
  });

  function formatPrice(price: number, currency: string = 'PHP'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function updateCountdowns() {
    data.products.forEach((product: any) => {
      const now = new Date().getTime();
      const end = new Date(product.auctionEndDate).getTime();
      const diff = end - now;

      if (diff <= 0) {
        countdowns[product.id] = 'Ended';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        countdowns[product.id] = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        countdowns[product.id] = `${hours}h ${minutes}m ${seconds}s`;
      } else {
        countdowns[product.id] = `${minutes}m ${seconds}s`;
      }
    });
  }

  function getUrgencyClass(endDate: string): string {
    const now = new Date().getTime();
    const end = new Date(endDate).getTime();
    const diff = end - now;
    const hoursLeft = diff / (1000 * 60 * 60);

    if (diff <= 0) return 'ended';
    if (hoursLeft <= 3) return 'critical'; // Less than 3 hours
    if (hoursLeft <= 12) return 'urgent'; // Less than 12 hours
    if (hoursLeft <= 24) return 'warning'; // Less than 24 hours
    return 'normal';
  }

  // Fetch user's bids
  async function fetchUserBids() {
    if (!$authStore.isAuthenticated || !$authStore.user) {
      userBids = {};
      userBidsByProduct = {};
      return;
    }

    try {
      const token = browser ? localStorage.getItem('auth_token') : null;
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `JWT ${token}`;
      }
      const response = await fetch(
        `/api/bridge/bids?where[bidder][equals]=${$authStore.user.id}&limit=1000`,
        {
          headers,
          credentials: 'include',
        }
      );

      if (response.ok) {
        const bidsData = await response.json();
        const bids = bidsData.docs || [];

        // Group bids by product and find highest bid per product
        const bidsByProduct: { [key: string]: any[] } = {};
        const highestBids: { [key: string]: number } = {};

        bids.forEach((bid: any) => {
          const productId = typeof bid.product === 'object' ? bid.product.id : bid.product;

          if (!bidsByProduct[productId]) {
            bidsByProduct[productId] = [];
          }
          bidsByProduct[productId].push(bid);

          if (!highestBids[productId] || bid.amount > highestBids[productId]) {
            highestBids[productId] = bid.amount;
          }
        });

        userBids = highestBids;
        userBidsByProduct = bidsByProduct;
      }
    } catch (error) {
      console.error('Error fetching user bids:', error);
    }
  }

  // Sort products to show ones with user bids first
  let sortedProducts = $derived([...data.products].sort((a, b) => {
    const aHasBid = userBids[a.id] ? 1 : 0;
    const bHasBid = userBids[b.id] ? 1 : 0;
    return bHasBid - aHasBid; // Products with bids first
  }));

  // Refetch bids when auth state changes
  $effect(() => {
    if ($authStore.isAuthenticated !== undefined) {
      fetchUserBids();
    }
  });

  onMount(() => {
    updateCountdowns();
    countdownInterval = setInterval(updateCountdowns, 1000);
    fetchUserBids();

    // Scroll to products section if there's a status query parameter
    // (useful when navigating from another page or using back/forward buttons)
    if (data.status && window.location.search.includes('status=')) {
      setTimeout(() => {
        const productsSection = document.getElementById('products-section');
        if (productsSection) {
          productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }

    // Handle visibility change - stop countdown when tab is not visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, stop countdown to save resources
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = null;
      } else {
        // Tab is visible again, restart countdown
        if (!countdownInterval) {
          updateCountdowns(); // Immediate update when returning
          countdownInterval = setInterval(updateCountdowns, 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup visibility listener on destroy
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  onDestroy(() => {
    if (countdownInterval) clearInterval(countdownInterval);
    if (searchTimeout) clearTimeout(searchTimeout);
  });
</script>

<svelte:head>
  <title>Browse Products - BidMo.to</title>
</svelte:head>
<!-- Beta Notice Banner -->
<div class="-mx-4 sm:-mx-6 lg:-mx-8 mb-0 overflow-hidden relative z-10">
  <div class="bg-white border-b-4 border-black px-3 py-4">
    <div class="max-w-7xl mx-auto text-center">
      <div class="inline-block bg-black text-white px-2 sm:px-3 py-1 text-xs font-bold tracking-wide sm:tracking-wider mb-2" style="font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">
        EXPERIMENTAL
      </div>
      <p class="text-black text-xs sm:text-sm md:text-base leading-snug sm:leading-relaxed mx-auto max-w-5xl px-2 break-words">
        We're testing what works and gathering public interest.
        <strong class="font-bold underline whitespace-nowrap">No integrated payments yet</strong> —
        transactions are coordinated directly between buyers and sellers.
        Once we have enough traction, we'll integrate secure payments and become a full-blown bidding platform!
      </p>
    </div>
  </div>
</div>

<!-- Welcome Hero Section -->
<div class="-mx-4 sm:-mx-6 lg:-mx-8 mb-8">
  <section class="bg-white border-b-8 border-black text-black px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16 text-center relative overflow-hidden">
    <ThreeHero />
    <div class="max-w-4xl mx-auto relative" style="z-index: 1;">
      <div class="mb-6">
        <img src="/bidmo.to.png" alt="BidMo.to" class="h-20 sm:h-28 lg:h-36 w-auto mx-auto" />
      </div>

      <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-3" style="font-family: 'Playfair Display', serif;">
        Welcome to <span class="text-black">BidMo.to</span>
      </h1>

      <p class="text-base sm:text-lg lg:text-xl mb-3" style="font-family: 'Source Serif 4', serif;">
        Bid mo 'to! The Filipino way to bid, buy, and sell unique items
      </p>

      <p class="text-sm sm:text-base mb-6 max-w-2xl mx-auto" style="color: #525252; font-family: 'Source Serif 4', serif;">
        Join us in building the Philippines' most exciting auction platform.
        Your participation helps us understand what features matter most!
      </p>

      <div class="flex flex-wrap gap-4 sm:gap-8 justify-center text-sm sm:text-base">
        <div class="flex items-center gap-2">
          <span class="text-xl">Browse Auctions</span>
        </div>
        {#if $authStore.isAuthenticated}
          <div class="flex items-center gap-2">
            <a href="/sell" class="text-black border-b-2 border-black hover:bg-black hover:text-white transition px-1">List an Item</a>
          </div>
        {/if}
        <div class="flex items-center gap-2" style="font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">
          <span class="text-xl font-bold">FREE</span>
          <span>To Join</span>
        </div>
        <div class="flex items-center gap-2" style="font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">
          <span class="text-xl font-bold">SAFE</span>
          <span>No Payment Integration</span>
        </div>
        <div class="flex items-center gap-2" style="font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">
          <span class="text-xl font-bold">BETA</span>
          <span>Help Us Grow</span>
        </div>
      </div>
    </div>
  </section>
</div>

<div class="products-page">
  <div class="page-header">
    <h2>Browse Products</h2>

    <!-- Search and Filters -->
    <div class="search-filter-container">
      <div class="search-container">
        <input
          type="text"
          bind:value={searchInput}
          oninput={handleSearchInput}
          placeholder="Search by title, description, or keywords..."
          class="search-input"
        />
        {#if searchInput}
          <button class="clear-search" onclick={() => { searchInput = ''; handleSearchInput(); }}>✕</button>
        {/if}
      </div>

      <div class="location-filters">
        <select
          bind:value={regionInput}
          onchange={handleLocationInput}
          class="location-select"
        >
          <option value="">All Regions</option>
          {#each regions as region}
            <option value={region}>{region}</option>
          {/each}
        </select>
        <select
          bind:value={cityInput}
          onchange={handleLocationInput}
          class="location-select"
          disabled={!regionInput}
        >
          <option value="">All Cities</option>
          {#each availableCities as city}
            <option value={city}>{city}</option>
          {/each}
        </select>
        {#if searchInput || regionInput || cityInput}
          <button class="btn-clear-filters" onclick={clearFilters}>Clear All</button>
        {/if}
      </div>
    </div>

    {#if (data.search || data.region || data.city) && data.totalDocs > 0}
      <p class="search-results">Found {data.totalDocs} result{data.totalDocs !== 1 ? 's' : ''}</p>
    {/if}

    <!-- Items per page selector -->
    <div class="controls-container">
      <div class="items-per-page">
        <label>Items per page:</label>
        <select value={data.limit} onchange={(e) => changeItemsPerPage(parseInt(e.currentTarget.value))}>
          {#each itemsPerPageOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  {#if (data.search || data.region || data.city) && data.totalDocs === 0}
    <div class="empty-state">
      <p>No products found matching your filters</p>
      {#if data.search}<p class="filter-detail">Search: "{data.search}"</p>{/if}
      {#if data.region}<p class="filter-detail">Region: "{data.region}"</p>{/if}
      {#if data.city}<p class="filter-detail">City: "{data.city}"</p>{/if}
      <button class="btn-clear-search" onclick={clearFilters}>Clear Filters</button>
    </div>
  {/if}

  <!-- Tabs - Always visible -->
  <div class="tabs-container" id="products-section">
    <button
      class="tab"
      class:active={data.status === 'active'}
      onclick={() => changeTab('active')}
    >
      Active Auctions
    </button>
    <button
      class="tab"
      class:active={data.status === 'ended'}
      onclick={() => changeTab('ended')}
    >
      Ended Auctions
    </button>
    <button
      class="tab"
      class:active={data.status === 'my-bids'}
      onclick={() => changeTab('my-bids')}
    >
      My Bids
    </button>
  </div>

  <!-- Products Grid -->
  {#if sortedProducts.length > 0}
      <section class="auction-section">
        <div class="products-grid">
          {#each sortedProducts as product}
            <a href="/products/{product.id}?from=browse" class="product-card" class:ended-card={data.status === 'ended'}>
              <div class="product-image">
                {#if product.images && product.images.length > 0 && product.images[0].image}
                  <img src="{product.images[0].image.url}" alt="{product.images[0].image.alt || product.title}" />
                {:else}
                  <div class="placeholder-image">
                    <span>No Image</span>
                  </div>
                {/if}
                {#if data.status === 'ended'}
                  <div class="ended-overlay">
                    {product.status === 'sold' ? '✓ SOLD' : product.status.toUpperCase()}
                  </div>
                {/if}
              </div>

              <div class="product-info">
                <h3>{product.title}</h3>
                <p class="description">{product.description.substring(0, 100)}{product.description.length > 100 ? '...' : ''}</p>

                {#if product.region || product.city}
                  <div class="location-info">
                    <svg class="location-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>{product.city}{product.city && product.region ? ', ' : ''}{product.region}</span>
                  </div>
                {/if}

                <div class="pricing">
                  {#if product.currentBid}
                    <div class="current-bid-section">
                      <div class="current-bid-row">
                        <div>
                          <span class="label-small">{data.status === 'ended' && product.status === 'sold' ? 'Sold For:' : data.status === 'ended' ? 'Final Bid:' : 'Current Bid:'}</span>
                          <span class="price-large current-bid">{formatPrice(product.currentBid, product.seller.currency)}</span>
                        </div>
                        {#if product.currentBid > product.startingPrice}
                          <div class="percent-increase">
                            <svg class="arrow-up-mini" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                              <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                            <span>{Math.round(((product.currentBid - product.startingPrice) / product.startingPrice) * 100)}%</span>
                          </div>
                        {/if}
                      </div>
                      <div class="starting-price-row">
                        <span class="label-tiny">Starting:</span>
                        <span class="price-tiny">{formatPrice(product.startingPrice, product.seller.currency)}</span>
                      </div>
                    </div>
                  {:else}
                    <div>
                      <span class="label-small">Starting Price:</span>
                      <span class="price-large">{formatPrice(product.startingPrice, product.seller.currency)}</span>
                    </div>
                  {/if}

                  {#if userBids[product.id]}
                    <div class="user-bid-section">
                      <span class="label-small">Your Bid:</span>
                      <span class="price-large your-bid">{formatPrice(userBids[product.id], product.seller.currency)}</span>
                    </div>
                  {/if}
                </div>

                <div class="auction-info">
                  <div class="status-row">
                    <span class="status status-{product.status}">{product.status}</span>
                    {#if $authStore.user && product.seller.id === $authStore.user.id}
                      <span class="owner-badge">Your Listing</span>
                    {/if}
                  </div>
                  {#if data.status === 'active' || data.status === 'my-bids'}
                    <div class="countdown-badge countdown-{getUrgencyClass(product.auctionEndDate)}">
                      <svg class="countdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>{countdowns[product.id] || 'Loading...'}</span>
                    </div>
                  {:else}
                    <div class="countdown-badge countdown-ended">
                      <svg class="countdown-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>Ended</span>
                    </div>
                  {/if}
                </div>
              </div>
            </a>
          {/each}
        </div>

        <!-- Pagination -->
        {#if data.totalPages > 1}
          <div class="pagination">
            <button
              class="pagination-btn"
              disabled={data.currentPage === 1}
              onclick={() => goToPage(data.currentPage - 1)}
            >
              ← Previous
            </button>

            <div class="pagination-numbers">
              {#each Array(data.totalPages) as _, i}
                <button
                  class="pagination-number"
                  class:active={data.currentPage === i + 1}
                  onclick={() => goToPage(i + 1)}
                >
                  {i + 1}
                </button>
              {/each}
            </div>

            <button
              class="pagination-btn"
              disabled={data.currentPage === data.totalPages}
              onclick={() => goToPage(data.currentPage + 1)}
            >
              Next →
            </button>
          </div>
        {/if}
      </section>
  {:else}
    <div class="empty-state">
      {#if data.status === 'my-bids'}
        <p>You do not have any bids yet.</p>
        <p><a href="/products?status=active">Browse Active Auctions</a></p>
      {:else if data.status === 'ended'}
        <p>No Ended Auctions Available</p>
        <p><a href="/products?status=active">Browse Active Auctions</a></p>
      {:else}
        <p>No active auctions available.</p>
        <p><a href="/sell">Be the first to list a product!</a></p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .products-page {
    padding: 2rem 0;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  h1 {
    margin-bottom: 1.5rem;
    font-size: 2.5rem;
    font-family: 'Playfair Display', serif;
  }

  h2 {
    font-family: 'Playfair Display', serif;
  }

  .search-filter-container {
    margin-bottom: 1rem;
  }

  .search-container {
    position: relative;
    max-width: 600px;
    margin-bottom: 1rem;
  }

  .search-input {
    width: 100%;
    padding: 1rem 3rem 1rem 1rem;
    font-size: 1rem;
    border: 1px solid #000;
    font-family: 'Source Serif 4', serif;
  }

  .search-input:focus {
    outline: none;
    border: 4px solid #000;
    box-shadow: none;
  }

  .location-filters {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    max-width: 600px;
  }

  .location-select {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
    border: 1px solid #000;
    background-color: white;
    cursor: pointer;
    font-family: 'Source Serif 4', serif;
  }

  .location-select:focus {
    outline: none;
    border: 4px solid #000;
    box-shadow: none;
  }

  .location-select:disabled {
    background-color: #F5F5F5;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-clear-filters {
    padding: 0.75rem 1.5rem;
    background: transparent;
    color: #000;
    border: 2px solid #000;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .btn-clear-filters:hover {
    background: #000;
    color: #fff;
  }

  .clear-search {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #525252;
    cursor: pointer;
    padding: 0.5rem;
    line-height: 1;
  }

  .clear-search:hover {
    color: #000;
  }

  .search-results {
    color: #525252;
    font-size: 0.95rem;
    margin: 0;
    font-family: 'JetBrains Mono', monospace;
  }

  .btn-clear-search {
    padding: 0.75rem 1.5rem;
    background: #000;
    color: #fff;
    border: 2px solid #000;
    font-weight: 600;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .btn-clear-search:hover {
    background: #fff;
    color: #000;
  }

  .controls-container {
    margin-top: 1rem;
  }

  .items-per-page {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .items-per-page label {
    font-size: 0.95rem;
    color: #525252;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .items-per-page select {
    padding: 0.5rem 2.5rem 0.5rem 0.75rem;
    font-size: 0.95rem;
    border: 1px solid #000;
    background-color: white;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    background-size: 1.25rem;
    cursor: pointer;
    appearance: none;
  }

  .items-per-page select:hover {
    border-color: #000;
  }

  .items-per-page select:focus {
    outline: none;
    border: 4px solid #000;
    box-shadow: none;
  }

  /* Tabs */
  .tabs-container {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid #000;
    padding-bottom: 0;
  }

  .tab {
    flex: 1;
    padding: 0.75rem 1rem;
    background: white;
    border: 2px solid #000;
    border-bottom: none;
    font-weight: 600;
    font-size: 1rem;
    color: #525252;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tab:hover {
    background: #F5F5F5;
    color: #000;
  }

  .tab.active {
    background: #000;
    border-color: #000;
    color: #fff;
  }

  .tab-badge {
    background: #F5F5F5;
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .tab.active .tab-badge {
    background: #fff;
    color: #000;
  }

  .auction-section {
    margin-bottom: 3rem;
  }

  .ended-card {
    opacity: 0.85;
  }

  .ended-card:hover {
    opacity: 1;
  }

  .ended-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 0.75rem 1.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    pointer-events: none;
    font-family: 'JetBrains Mono', monospace;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background-color: #F5F5F5;
    border: 1px solid #000;
  }

  .empty-state p {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    font-family: 'Source Serif 4', serif;
  }

  .empty-state .filter-detail {
    font-size: 1rem;
    color: #525252;
    margin-bottom: 0.5rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .empty-state a {
    color: #000;
    font-weight: bold;
    border-bottom: 2px solid #000;
  }

  .products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 2rem;
  }

  .product-card {
    background: white;
    border: 1px solid #000;
    overflow: hidden;
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
  }

  .product-card:hover {
    border-width: 2px;
    background: #000;
    color: #fff;
  }

  .product-image {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
    background-color: #F5F5F5;
  }

  .product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-image {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #F5F5F5;
    color: #525252;
    font-size: 1.2rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .product-info {
    padding: 1.5rem;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .product-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-family: 'Playfair Display', serif;
  }

  .description {
    color: #525252;
    margin-bottom: 0.75rem;
    flex: 1;
    font-family: 'Source Serif 4', serif;
  }

  .location-info {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.85rem;
    color: #525252;
    margin-bottom: 0.75rem;
    padding: 0.375rem 0.5rem;
    background-color: #F5F5F5;
    width: fit-content;
    font-family: 'JetBrains Mono', monospace;
  }

  .location-icon {
    color: #000;
    flex-shrink: 0;
  }

  .pricing {
    margin-bottom: 1rem;
  }

  .pricing > div {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .current-bid-section {
    margin-bottom: 0.75rem;
  }

  .current-bid-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .current-bid-row > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .starting-price-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    opacity: 0.7;
  }

  .user-bid-section {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background: #F5F5F5;
    border: 2px solid #000;
    margin-top: 0.5rem;
  }

  .label {
    color: #525252;
    font-size: 0.9rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .label-small {
    color: #525252;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  .label-tiny {
    color: #525252;
    font-size: 0.7rem;
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .price {
    font-weight: bold;
    font-size: 1.1rem;
  }

  .price-large {
    font-weight: 900;
    font-size: 1.4rem;
    display: block;
  }

  .price-tiny {
    font-size: 0.85rem;
    font-weight: 600;
    color: #525252;
  }

  .current-bid {
    color: #000;
  }

  .your-bid {
    color: #000;
  }

  .percent-increase {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #000;
    color: #fff;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  .arrow-up-mini {
    color: white;
    flex-shrink: 0;
  }

  .auction-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #000;
  }

  .status-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .status {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: bold;
    text-transform: uppercase;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.05em;
  }

  .owner-badge {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    background: #000;
    color: #fff;
    letter-spacing: 0.05em;
    font-family: 'JetBrains Mono', monospace;
  }

  .status-active {
    background: #000;
    color: #fff;
  }

  .status-ended {
    background: #fff;
    color: #000;
    border: 2px solid #000;
  }

  .status-sold {
    background: #000;
    color: #fff;
  }

  .status-cancelled {
    background: #fff;
    color: #525252;
    border: 1px solid #525252;
  }

  .countdown-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  .countdown-icon {
    flex-shrink: 0;
  }

  /* Normal - More than 24 hours */
  .countdown-normal {
    background-color: #fff;
    color: #000;
    border: 1px solid #000;
  }

  /* Warning - Less than 24 hours */
  .countdown-warning {
    background-color: #fff;
    color: #000;
    border: 2px solid #000;
    font-weight: bold;
  }

  /* Urgent - Less than 12 hours */
  .countdown-urgent {
    background: #fff;
    color: #000;
    border: 4px solid #000;
    font-weight: 800;
    text-transform: uppercase;
  }

  /* Critical - Less than 3 hours */
  .countdown-critical {
    background: #000;
    color: #fff;
  }

  /* Ended */
  .countdown-ended {
    background-color: #fff;
    color: #525252;
    text-decoration: line-through;
    border: 1px solid #E5E5E5;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 2rem;
    padding: 1rem;
  }

  .pagination-btn {
    padding: 0.625rem 1.25rem;
    background-color: white;
    border: 2px solid #000;
    color: #000;
    font-weight: 600;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pagination-btn:hover:not(:disabled) {
    background-color: #000;
    color: #fff;
  }

  .pagination-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    border-color: #E5E5E5;
    color: #525252;
  }

  .pagination-numbers {
    display: flex;
    gap: 0.25rem;
  }

  .pagination-number {
    min-width: 2.5rem;
    padding: 0.625rem 0.75rem;
    background-color: white;
    border: 2px solid #000;
    color: #000;
    font-weight: 600;
    cursor: pointer;
    font-family: 'JetBrains Mono', monospace;
  }

  .pagination-number:hover {
    border-color: #000;
    background-color: #F5F5F5;
    color: #000;
  }

  .pagination-number.active {
    background-color: #000;
    border-color: #000;
    color: #fff;
  }
</style>