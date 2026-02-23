<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { authStore } from '$lib/stores/auth';
  import ThreeAuthBackground from '$lib/components/three/ThreeAuthBackground.svelte';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let countryCode = $state('+63');
  let phoneNumber = $state('');
  let submitting = $state(false);
  let error = $state('');
  let success = $state(false);

  // Country codes list with common countries
  const countryCodes = [
    { code: '+63', country: 'Philippines', flag: '🇵🇭' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+82', country: 'South Korea', flag: '🇰🇷' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+66', country: 'Thailand', flag: '🇹🇭' },
    { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+39', country: 'Italy', flag: '🇮🇹' },
    { code: '+34', country: 'Spain', flag: '🇪🇸' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  ];

  // Get redirect URL from query params - only allow relative paths to prevent open redirect
  function getSafeRedirect(url: string | null): string {
    if (!url) return '/';
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    return '/';
  }
  const redirectUrl = getSafeRedirect(page.url.searchParams.get('redirect'));

  async function handleRegister(e: Event) {
    e.preventDefault();

    error = '';
    success = false;

    // Validation
    if (!name || !email || !password || !confirmPassword || !phoneNumber) {
      error = 'Please fill in all fields';
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    if (password.length < 6) {
      error = 'Password must be at least 6 characters';
      return;
    }

    // Phone number validation - basic check for digits only
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      error = 'Please enter a valid phone number';
      return;
    }

    submitting = true;

    try {
      const response = await fetch('/api/bridge/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          password,
          countryCode,
          phoneNumber: phoneNumber.replace(/\D/g, ''), // Store only digits
          role: 'seller', // Users can both buy and sell
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.errors?.[0]?.message || 'Registration failed');
      }

      success = true;

      // Automatically log them in after registration
      setTimeout(async () => {
        const loginResponse = await fetch('/api/bridge/users/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        if (loginResponse.ok) {
          const data = await loginResponse.json();

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
        }
      }, 1500);
    } catch (err: any) {
      error = err.message || 'Registration failed. Please try again.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Register - BidMo.to</title>
</svelte:head>

<div class="register-page" style="position: relative; overflow: hidden;">
  <ThreeAuthBackground />
  <div class="register-container" style="position: relative; z-index: 1;">
    <h1>Create Account</h1>
    <p class="subtitle">Join our marketplace to buy and sell products</p>

    {#if success}
      <div class="success-message">
        Account created successfully! Logging you in...
      </div>
    {/if}

    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}

    <form onsubmit={handleRegister}>
      <div class="form-group">
        <label for="name">Full Name</label>
        <input
          id="name"
          type="text"
          bind:value={name}
          placeholder="John Doe"
          required
          disabled={submitting || success}
        />
      </div>

      <div class="form-group">
        <label for="email">Email Address</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="your@email.com"
          required
          disabled={submitting || success}
        />
      </div>

      <div class="form-group">
        <label for="phone">Phone Number</label>
        <div class="phone-input-group">
          <select
            id="countryCode"
            bind:value={countryCode}
            disabled={submitting || success}
            class="country-code-select"
          >
            {#each countryCodes as { code, country, flag }}
              <option value={code}>{flag} {code}</option>
            {/each}
          </select>
          <input
            id="phone"
            type="tel"
            bind:value={phoneNumber}
            placeholder="9XX XXX XXXX"
            required
            disabled={submitting || success}
            class="phone-input"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Enter a strong password (min 6 characters)"
          required
          disabled={submitting || success}
        />
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          bind:value={confirmPassword}
          placeholder="Re-enter your password"
          required
          disabled={submitting || success}
        />
      </div>

      <button type="submit" disabled={submitting || success}>
        {submitting ? 'Creating Account...' : 'Create Account'}
      </button>
    </form>

    <div class="additional-info">
      <p>Already have an account? <a href="/login?redirect={encodeURIComponent(redirectUrl)}">Login here</a></p>
      <div class="features">
        <h3>Why join?</h3>
        <ul>
          <li>✓ Sell your products to a global audience</li>
          <li>✓ Bid on unique items from sellers worldwide</li>
          <li>✓ Track your bids and listings in one place</li>
          <li>✓ Secure transactions and buyer protection</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<style>
  .register-page {
    min-height: calc(100vh - 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #fff;
  }

  .register-container {
    max-width: 500px;
    width: 100%;
    background-color: white;
    padding: 3rem;
    border: 4px solid #000;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    text-align: center;
    color: #333;
  }

  .subtitle {
    color: #666;
    text-align: center;
    margin-bottom: 2rem;
  }

  .success-message {
    background-color: #000;
    color: white;
    padding: 1rem;
    margin-bottom: 1.5rem;
    text-align: center;
    font-weight: 500;
  }

  .error-message {
    background-color: #fff;
    color: #000;
    border: 4px solid #000;
    padding: 1rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #333;
  }

  input {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
    border: 1px solid #000;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  input:focus {
    outline: none;
    border-color: #000;
    border-width: 4px;
    box-shadow: none;
    padding: calc(0.875rem - 3px);
  }

  input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .phone-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .country-code-select {
    width: 110px;
    padding: 0.875rem 0.5rem;
    font-size: 1rem;
    border: 1px solid #000;
    font-family: inherit;
    background-color: white;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .country-code-select:focus {
    outline: none;
    border-color: #000;
    border-width: 4px;
    box-shadow: none;
  }

  .country-code-select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .phone-input {
    flex: 1;
  }

  button {
    width: 100%;
    padding: 1rem;
    font-size: 1.1rem;
    font-weight: 600;
    background-color: #000;
    color: #fff;
    border: 2px solid #000;
    cursor: pointer;
    margin-top: 1rem;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    transition: background-color 0.2s, color 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: #fff;
    color: #000;
  }

  button:disabled {
    background: #E5E5E5;
    border-color: #E5E5E5;
    color: #525252;
    cursor: not-allowed;
  }

  .additional-info {
    margin-top: 2rem;
    text-align: center;
  }

  .additional-info > p {
    color: #666;
    margin-bottom: 1.5rem;
  }

  .additional-info a {
    color: #000;
    text-decoration: underline;
    font-weight: 600;
  }

  .additional-info a:hover {
    text-decoration: underline;
  }

  .features {
    text-align: left;
    background-color: #F5F5F5;
    padding: 1.5rem;
    border: 1px solid #000;
    margin-top: 1.5rem;
  }

  .features h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;
    font-size: 1.1rem;
  }

  .features ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .features li {
    padding: 0.5rem 0;
    color: #555;
  }
</style>
