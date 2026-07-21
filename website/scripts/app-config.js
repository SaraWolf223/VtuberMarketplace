(function () {
  // Applies the buyer's admin-configured branding (logo, colors, app name,
  // support email) to the marketing landing page at runtime. Safe to fail
  // silently — the page already looks correct with the bundled defaults.
  const config = window.LOCAL_MARKETPLACE_WAITLIST || {};
  const supabaseUrl = config.supabaseUrl;
  const supabaseAnonKey = config.supabaseAnonKey;
  if (!supabaseUrl || !supabaseAnonKey) return;

  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  function hexToRgbTriplet(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ');
  }

  function applyColor(varName, rgbVarName, hex) {
    if (!hex || !HEX_RE.test(hex)) return;
    document.documentElement.style.setProperty(varName, hex);
    if (rgbVarName) {
      document.documentElement.style.setProperty(rgbVarName, hexToRgbTriplet(hex));
    }
  }

  function applyConfig(rows) {
    const map = {};
    rows.forEach(function (row) {
      map[row.key] = row.value;
    });

    const colors = map.branding_colors || {};
    applyColor('--primary', '--primary-rgb', colors.primary);
    applyColor('--primary-dark', null, colors.primaryDark);
    applyColor('--accent', null, colors.accent);

    const logoUrl = map.branding_logo_url;
    if (typeof logoUrl === 'string' && logoUrl) {
      document.querySelectorAll('[data-brand-logo]').forEach(function (img) {
        img.src = logoUrl;
      });
      const favicon = document.querySelector('[data-brand-favicon]');
      if (favicon) favicon.href = logoUrl;
    }

    const appName = map.app_display_name;
    if (typeof appName === 'string' && appName.trim()) {
      document.querySelectorAll('[data-brand-name]').forEach(function (el) {
        el.textContent = appName;
      });
    }

    const supportEmail = map.support_email;
    if (typeof supportEmail === 'string' && supportEmail.trim()) {
      document.querySelectorAll('[data-brand-support-email]').forEach(function (el) {
        el.textContent = supportEmail;
        el.href = 'mailto:' + supportEmail;
      });
    }

    if (typeof colors.primary === 'string' && HEX_RE.test(colors.primary)) {
      const themeColorMeta = document.querySelector('[data-brand-theme-color]');
      if (themeColorMeta) themeColorMeta.content = colors.primary;
    }
  }

  fetch(supabaseUrl + '/rest/v1/public_app_config?select=key,value', {
    headers: { apikey: supabaseAnonKey, Authorization: 'Bearer ' + supabaseAnonKey },
  })
    .then(function (res) {
      if (!res.ok) throw new Error('app config request failed');
      return res.json();
    })
    .then(applyConfig)
    .catch(function () {
      /* keep bundled defaults */
    });
})();
