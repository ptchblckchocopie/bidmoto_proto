<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    goto('/dashboard?tab=purchases', { replaceState: true });
  });
</script>

<div class="redirect-message">
  <p>Redirecting to Dashboard...</p>
</div>

<style>
  .redirect-message {
    text-align: center;
    padding: 4rem 2rem;
    color: #525252;
    font-size: 1.2rem;
    font-family: 'Source Serif 4', serif;
  }
</style>
