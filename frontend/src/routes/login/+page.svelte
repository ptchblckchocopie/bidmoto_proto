<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { authStore } from '$lib/stores/auth';
  import ThreeAuthBackground from '$lib/components/three/ThreeAuthBackground.svelte';

  let email = $state('');
  let password = $state('');
  let submitting = $state(false);
  let error = $state('');

  // Get redirect URL from query params - only allow relative paths to prevent open redirect
  function getSafeRedirect(url: string | null): string {
    if (!url) return '/';
    // Only allow paths starting with / and not // (protocol-relative URLs)
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    return '/';
  }
  const redirectUrl = getSafeRedirect(page.url.searchParams.get('redirect'));

  async function handleLogin(e: Event) {
    e.preventDefault();

    error = '';
    submitting = true;

    try {
      const response = await fetch('/api/bridge/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid email or password');
      }

      const data = await response.json();

      // Store JWT token and user data in localStorage
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('user_data', JSON.stringify(data.user));
      }

      // Update auth store
      authStore.set({
        isAuthenticated: true,
        user: data.user,
        token: data.token,
      });

      // Redirect to the intended page or homepage
      goto(redirectUrl);
    } catch (err: any) {
      error = err.message || 'Invalid email or password. Please try again.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Login - Marketplace Platform</title>
</svelte:head>

<div class="login-page" style="position: relative; overflow: hidden;">
  <ThreeAuthBackground />
  <div class="login-container" style="position: relative; z-index: 1;">
    <h1>Login</h1>
    <p class="subtitle">Access your marketplace account</p>

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    <form onsubmit={handleLogin}>
      <div class="form-group">
        <label for="email">Email Address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="your@email.com"
          required
          disabled={submitting}
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Enter your password"
          required
          disabled={submitting}
        />
      </div>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Logging in...' : 'Login'}
      </button>
    </form>

    <div class="additional-info">
      <p>Don't have an account? <a href="/register?redirect={encodeURIComponent(redirectUrl)}">Register here</a></p>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: calc(100vh - 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .login-container {
    max-width: 450px;
    width: 100%;
    background-color: white;
    padding: 3rem;
    border: 2px solid #000;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    text-align: center;
  }

  .subtitle {
    color: #666;
    text-align: center;
    margin-bottom: 2rem;
  }

  .error-message {
    background-color: #fff;
    color: #000;
    border: 4px solid #000;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #333;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    font-size: 1rem;
    border: 1px solid #000;
    font-family: inherit;
  }

  input:focus {
    outline: none;
    border-color: #000;
    border-width: 4px;
    box-shadow: none;
    padding: calc(0.75rem - 3px);
  }

  input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  button {
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
    background-color: #000;
    color: white;
    border: 2px solid #000;
    cursor: pointer;
    margin-top: 1rem;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  button:hover:not(:disabled) {
    background-color: #fff;
    color: #000;
  }

  button:disabled {
    background-color: #E5E5E5;
    border-color: #E5E5E5;
    color: #525252;
    cursor: not-allowed;
  }

  .additional-info {
    margin-top: 2rem;
    text-align: center;
    color: #666;
  }

  .additional-info a {
    color: #000;
    text-decoration: underline;
  }

  .additional-info a:hover {
    text-decoration: underline;
  }
</style>
