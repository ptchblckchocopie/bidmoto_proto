<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { onMount } from 'svelte';
  import ProductForm from '$lib/components/ProductForm.svelte';
  import type { Product } from '$lib/api';

  onMount(() => {
    if (!$authStore.isAuthenticated) {
      goto('/login?redirect=/sell');
    }
  });

  function handleSuccess(product: Product) {
    setTimeout(() => {
      goto(`/products/${product.id}`);
    }, 1500);
  }
</script>

<svelte:head>
  <title>Sell Your Product - BidMo.to</title>
</svelte:head>

<div class="sell-page">
  <h1>List Your Product</h1>
  <p class="subtitle">Create a new auction listing for your product</p>

  <div class="form-container">
    <ProductForm mode="create" onSuccess={handleSuccess} />
  </div>

  <div class="info-box">
    <h3>Before You List</h3>
    <ul>
      <li>You must be logged in to create a listing</li>
      <li>Make sure to provide accurate and detailed information</li>
      <li>Set a competitive starting price (minimum 100 {$authStore.user?.currency || 'PHP'})</li>
      <li>Set an appropriate bid increment for your product</li>
      <li>Choose an appropriate auction end date</li>
      <li>Upload 1-5 high-quality product images</li>
    </ul>
  </div>
</div>

<style>
  .sell-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 0;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #666;
    margin-bottom: 2rem;
    font-size: 1.1rem;
  }

  .form-container {
    background-color: white;
    padding: 2rem;
    border: 2px solid #000;
    margin-bottom: 2rem;
  }

  .info-box {
    background-color: #F5F5F5;
    padding: 1.5rem;
    border: 1px solid #000;
    border-left: 8px solid #000;
  }

  .info-box h3 {
    margin-top: 0;
    color: #000;
  }

  .info-box ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #525252;
  }

  .info-box li {
    margin-bottom: 0.5rem;
  }
</style>
