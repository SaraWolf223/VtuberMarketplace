(function () {
  const SUPPORT_EMAIL = 'support@yourdomain.com';
  const config = window.LOCAL_MARKETPLACE_WAITLIST || {
    supabaseUrl: '',
    supabaseAnonKey: '',
    formspreeEndpoint: '',
    endpoint: '',
    source: 'landing-page',
  };

  // Prefer an explicit configured origin (useful behind a CDN/proxy); otherwise
  // fall back to wherever the page is actually being served from, so referral
  // links are correct out of the box on any domain without extra setup.
  const SITE_ORIGIN = (config.siteOrigin || window.location.origin || '').replace(/\/$/, '');
  // Only surface a hard number once it's credible; below this we fall back to
  // qualitative proof so the page never shows a weak count.
  const SOCIAL_PROOF_FLOOR = 250;

  const forms = Array.prototype.slice.call(
    document.querySelectorAll('[data-waitlist-form]')
  );
  const mainForm = document.getElementById('waitlist-form');

  // Canonical result UI lives inside the main #waitlist form.
  const foundingBlock = document.getElementById('founding-code-block');
  const foundingCodeEl = document.getElementById('founding-code-value');
  const copyCodeBtn = document.getElementById('copy-founding-code');

  // Referral share UI — sibling of the founding-code block (not nested inside
  // it), since returning users can get a referral link without a founding code.
  const shareBlock = document.getElementById('referral-share-block');
  const shareLinkEl = document.getElementById('referral-share-link');
  const copyShareBtn = document.getElementById('copy-referral-link');
  const shareNativeBtn = document.getElementById('share-native');
  const shareSmsBtn = document.getElementById('share-sms');
  const shareXBtn = document.getElementById('share-x');
  const referralCountEl = document.getElementById('referral-count');

  let lastShareUrl = '';

  if (!forms.length) return;

  // ---------------------------------------------------------------------------
  // Cloudflare Turnstile bot protection (Phase 9 white-label plan) — a no-op
  // until `turnstileSiteKey` is set in waitlist-config.js, so the waitlist
  // keeps working out of the box before a buyer configures Cloudflare.
  // ---------------------------------------------------------------------------
  const turnstileSiteKey = (config.turnstileSiteKey || '').trim();
  const turnstileWidgetIds = new Map(); // form -> widget id

  function renderTurnstileWidgets() {
    if (!turnstileSiteKey || !window.turnstile) return;
    forms.forEach(function (form) {
      if (turnstileWidgetIds.has(form)) return;
      const el = form.querySelector('[data-turnstile-widget]');
      if (!el) return;
      const id = window.turnstile.render(el, { sitekey: turnstileSiteKey });
      turnstileWidgetIds.set(form, id);
    });
  }

  window.onTurnstileWidgetLoad = renderTurnstileWidgets;
  // In case the Turnstile script already finished loading before this file ran.
  renderTurnstileWidgets();

  function getTurnstileToken(form) {
    if (!turnstileSiteKey || !window.turnstile) return '';
    const id = turnstileWidgetIds.get(form);
    if (id === undefined) return '';
    return window.turnstile.getResponse(id) || '';
  }

  function resetTurnstile(form) {
    if (!turnstileSiteKey || !window.turnstile) return;
    const id = turnstileWidgetIds.get(form);
    if (id !== undefined) window.turnstile.reset(id);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function getRefParam() {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref') || '';
      const cleaned = ref.trim().slice(0, 40);
      return /^[A-Za-z0-9_-]{3,40}$/.test(cleaned) ? cleaned : '';
    } catch {
      return '';
    }
  }

  function messageElFor(form) {
    return form.querySelector('[data-form-message]');
  }

  function submitBtnFor(form) {
    return form.querySelector('[type="submit"]');
  }

  function showMessage(form, text, type) {
    const el = messageElFor(form);
    if (!el) return;
    el.textContent = text;
    el.className = (el.className.split(' ')[0] || 'form-message') +
      ' form-message visible ' + type;
  }

  function clearMessage(form) {
    const el = messageElFor(form);
    if (!el) return;
    el.textContent = '';
    el.className = (el.className.split(' ')[0] || 'form-message') + ' form-message';
  }

  function setSubmitting(form, busy) {
    const btn = submitBtnFor(form);
    if (!btn) return;
    if (busy) {
      btn.dataset.prevLabel = btn.dataset.prevLabel || btn.innerHTML;
      btn.disabled = true;
      btn.textContent = 'Sending…';
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.prevLabel || btn.dataset.defaultLabel || 'Join the waitlist';
    }
  }

  function hideFoundingCode() {
    if (foundingBlock) foundingBlock.hidden = true;
  }

  function hideReferralShare() {
    if (shareBlock) shareBlock.hidden = true;
  }

  function buildShareUrl(referralCode) {
    return SITE_ORIGIN + '/?ref=' + encodeURIComponent(referralCode);
  }

  function renderReferralShare(result) {
    if (!shareBlock) return;
    const code = result && result.referral_code;
    if (!code || !/^[A-Za-z0-9_-]{3,40}$/.test(code)) {
      shareBlock.hidden = true;
      return;
    }
    lastShareUrl = buildShareUrl(code);
    if (shareLinkEl) {
      if ('value' in shareLinkEl) shareLinkEl.value = lastShareUrl;
      else shareLinkEl.textContent = lastShareUrl;
    }
    if (referralCountEl) {
      const count = Number(result.referral_count) || 0;
      referralCountEl.textContent = String(count);
      const wrap = referralCountEl.closest('[data-referral-count-wrap]');
      if (wrap) wrap.hidden = false;
    }
    const inviteText =
      'Join the VTuber Marketplace waitlist — pre-made digital VTuber assets with real checkout.';
    if (shareSmsBtn) {
      shareSmsBtn.setAttribute(
        'href',
        'sms:?&body=' + encodeURIComponent(inviteText + ' ' + lastShareUrl)
      );
    }
    if (shareXBtn) {
      shareXBtn.setAttribute(
        'href',
        'https://twitter.com/intent/tweet?text=' +
          encodeURIComponent(inviteText) +
          '&url=' +
          encodeURIComponent(lastShareUrl)
      );
    }
    if (shareNativeBtn) {
      shareNativeBtn.hidden = !(navigator.share);
    }
    shareBlock.hidden = false;
  }

  function showFoundingCode(code) {
    if (!foundingCodeEl || !foundingBlock || !/^FC-[A-Z0-9]{6,12}$/.test(code)) {
      return false;
    }
    foundingCodeEl.textContent = code;
    foundingBlock.hidden = false;
    return true;
  }

  function scrollToWaitlist() {
    const target = document.getElementById('waitlist');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildPayload(form) {
    const fd = new FormData(form);
    return {
      email: String(fd.get('email') || '').trim(),
      zip: String(fd.get('zip') || '').trim(),
      role: fd.get('role') || 'both',
      platform: fd.get('platform') || 'unspecified',
      source: config.source || 'landing-page',
      website: String(fd.get('website') || '').trim(),
      ref: getRefParam(),
      turnstileToken: getTurnstileToken(form),
    };
  }

  // ---------------------------------------------------------------------------
  // Network
  // ---------------------------------------------------------------------------
  async function joinViaSupabase(payload) {
    const baseUrl = (config.supabaseUrl || '').replace(/\/$/, '');
    const anonKey = config.supabaseAnonKey || '';
    if (!baseUrl || !anonKey) {
      return null;
    }

    const res = await fetch(baseUrl + '/functions/v1/join-waitlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        apikey: anonKey,
        Authorization: 'Bearer ' + anonKey,
      },
      body: JSON.stringify({
        email: payload.email,
        zip: payload.zip,
        role: payload.role,
        platform: payload.platform,
        source: payload.source,
        website: payload.website,
        ref: payload.ref,
        turnstileToken: payload.turnstileToken,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.ok) {
      const msg = json.error?.message || 'Waitlist request failed';
      throw new Error(msg);
    }
    return json.data;
  }

  async function sendFormspreeBackup(payload) {
    const endpoint = config.formspreeEndpoint || config.endpoint || '';
    if (!endpoint || !endpoint.includes('formspree.io')) return;

    const fd = new FormData();
    fd.append('email', payload.email);
    fd.append('zip', payload.zip);
    fd.append('role', payload.role);
    fd.append('source', payload.source);
    await fetch(endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: fd,
    });
  }

  // ---------------------------------------------------------------------------
  // Live signup counter (social proof)
  // ---------------------------------------------------------------------------
  function formatCount(total) {
    const floored = Math.floor(total / 50) * 50;
    return floored.toLocaleString('en-US') + '+';
  }

  function renderSocialProof(total) {
    const nodes = document.querySelectorAll('[data-social-proof]');
    if (!nodes.length) return;
    // Upgrade to a hard number only once it's credible; otherwise keep the
    // honest qualitative line that's already in the markup (never hide it).
    let text = '';
    if (total >= SOCIAL_PROOF_FLOOR) {
      text = 'Join ' + formatCount(total) + ' creators on the early-access list';
    }
    nodes.forEach(function (node) {
      node.hidden = false;
      if (text) {
        const textNode = node.querySelector('[data-social-proof-text]');
        if (textNode) textNode.textContent = text;
      }
    });
  }

  async function fetchWaitlistCount() {
    const baseUrl = (config.supabaseUrl || '').replace(/\/$/, '');
    const anonKey = config.supabaseAnonKey || '';
    if (!baseUrl || !anonKey) return;
    try {
      const res = await fetch(baseUrl + '/rest/v1/rpc/get_waitlist_public_stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          apikey: anonKey,
          Authorization: 'Bearer ' + anonKey,
        },
        body: '{}',
      });
      if (!res.ok) return;
      const data = await res.json();
      const total =
        typeof data === 'number'
          ? data
          : Number(data && (data.total ?? data.count)) || 0;
      renderSocialProof(total);
    } catch {
      /* counter is best-effort; never block the page */
    }
  }

  // ---------------------------------------------------------------------------
  // Copy / share buttons
  // ---------------------------------------------------------------------------
  function wireCopyButton(btn, getValue, defaultLabel) {
    if (!btn) return;
    btn.addEventListener('click', function () {
      const value = getValue();
      if (!value) return;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value).then(
          function () {
            btn.textContent = 'Copied!';
            setTimeout(function () {
              btn.textContent = defaultLabel;
            }, 2000);
          },
          function () {
            window.prompt('Copy this:', value);
          }
        );
      } else {
        window.prompt('Copy this:', value);
      }
    });
  }

  wireCopyButton(copyCodeBtn, function () {
    return foundingCodeEl ? foundingCodeEl.textContent || '' : '';
  }, 'Copy code');

  wireCopyButton(copyShareBtn, function () {
    return lastShareUrl;
  }, 'Copy link');

  if (shareNativeBtn) {
    shareNativeBtn.addEventListener('click', function () {
      if (!navigator.share || !lastShareUrl) return;
      navigator
        .share({
          title: 'VTuber Marketplace',
          text: 'Join the VTuber Marketplace waitlist for launch updates.',
          url: lastShareUrl,
        })
        .catch(function () {
          /* user cancelled share */
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Submit handler (shared across hero + main forms)
  // ---------------------------------------------------------------------------
  async function handleSubmit(form, e) {
    e.preventDefault();
    hideFoundingCode();
    hideReferralShare();
    clearMessage(form);
    setSubmitting(form, true);

    const payload = buildPayload(form);
    const isMain = form === mainForm;

    if (!payload.email) {
      showMessage(form, 'Enter your email to join the waitlist.', 'error');
      setSubmitting(form, false);
      return;
    }

    const zipDigits = String(payload.zip || '00000').replace(/\D/g, '');
    if (zipDigits.length !== 5) {
      payload.zip = '00000';
    } else {
      payload.zip = zipDigits;
    }

    if (!['buy', 'sell', 'both'].includes(payload.role)) {
      payload.role = 'both';
    }

    try {
      const result = await joinViaSupabase(payload);

      if (result?.founding_code) {
        const rendered = showFoundingCode(result.founding_code);
        renderReferralShare(result);
        showMessage(
          form,
          result.message ||
            'You’re on the waitlist! We’ll email you when VTuber Marketplace launches.',
          'success'
        );
        try {
          await sendFormspreeBackup(payload);
        } catch {
          /* optional inbox copy */
        }
        form.reset();
        setSubmitting(form, false);
        if (rendered && !isMain) scrollToWaitlist();
        return;
      }

      if (result?.message) {
        // Returning signup: no founding code, but we can still surface a
        // shareable referral link if the backend returned one.
        renderReferralShare(result);
        showMessage(form, result.message, 'success');
        form.reset();
        setSubmitting(form, false);
        if (!shareBlock?.hidden && !isMain) scrollToWaitlist();
        return;
      }

      const legacyEndpoint = config.formspreeEndpoint || config.endpoint;
      if (legacyEndpoint) {
        const isFormspree = legacyEndpoint.includes('formspree.io');
        let res;
        if (isFormspree) {
          const fd = new FormData();
          fd.append('email', payload.email);
          fd.append('zip', payload.zip);
          fd.append('role', payload.role);
          fd.append('source', payload.source);
          res = await fetch(legacyEndpoint, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: fd,
          });
        } else {
          res = await fetch(legacyEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(payload),
          });
        }
        if (!res.ok) throw new Error('Request failed');
        showMessage(
          form,
          "You're on the list — we'll email when VTuber Marketplace launches.",
          'success'
        );
        form.reset();
      } else {
        showMessage(
          form,
          'Waitlist is not configured yet. Set Supabase URL + anon key in waitlist-config.js, or email ' +
            SUPPORT_EMAIL,
          'error'
        );
      }
    } catch (err) {
      // A failed submit consumes the Turnstile token; reset the widget so a
      // retry doesn't silently resend a stale/empty token.
      resetTurnstile(form);
      showMessage(
        form,
        err instanceof Error
          ? err.message
          : 'Something went wrong. Try again or email ' + SUPPORT_EMAIL,
        'error'
      );
    }

    setSubmitting(form, false);
  }

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      handleSubmit(form, e);
    });
  });

  // ---------------------------------------------------------------------------
  // Smooth scroll for in-page anchors
  // ---------------------------------------------------------------------------
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (ev) {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        ev.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Mobile nav
  // ---------------------------------------------------------------------------
  const menuToggle = document.getElementById('menu-toggle');
  const headerNav = document.querySelector('.header-nav');
  if (menuToggle && headerNav) {
    menuToggle.addEventListener('click', function () {
      headerNav.classList.toggle('open');
    });
  }

  // ---------------------------------------------------------------------------
  // Sticky mobile CTA — hide once the waitlist form is on screen
  // ---------------------------------------------------------------------------
  const stickyCta = document.getElementById('sticky-cta');
  const waitlistSection = document.getElementById('waitlist');
  if (stickyCta && waitlistSection && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          stickyCta.classList.toggle('sticky-cta--hidden', entry.isIntersecting);
        });
      },
      { threshold: 0.12 }
    );
    io.observe(waitlistSection);
  }

  // ---------------------------------------------------------------------------
  // Kick off best-effort social proof counter
  // ---------------------------------------------------------------------------
  fetchWaitlistCount();
})();
