// Unified JavaScript for all pages of the StarUzBot site.
// This script consolidates the functionality that was previously embedded
// directly inside the HTML pages (index, packages, stars, premium).
// It handles navigation actions, ripple effects, purchase modals,
// form submission and the animated particle background.

(() => {
  // Wait until DOM is ready to start attaching listeners and running logic
  document.addEventListener('DOMContentLoaded', () => {
    /* ------------------------------------------------------------------
     * Navigation buttons on the home page
     * On the landing page there are three buttons: buy stars, view packages
     * and order Premium.  The primary button is disabled in HTML but we
     * enable it here so it becomes clickable.  The Premium button is
     * also wired up via JS to avoid inline event handlers.  We only
     * attach these handlers if the elements exist to keep the code safe
     * on other pages.
     */
    const btnBuyStars = document.querySelector('.btn.btn-primary');
    if (btnBuyStars && /Купить звёзды/i.test(btnBuyStars.textContent)) {
      btnBuyStars.removeAttribute('disabled');
      btnBuyStars.addEventListener('click', () => {
        window.location.href = 'stars_clickable.html';
      });
    }
    // Packages button uses an inline handler in the HTML; leave it.
    // Hook up the premium button if present: navigate to our new Premium page.
    const btnPremium = document.querySelector('.premium-btn');
    if (btnPremium) {
      btnPremium.removeAttribute('disabled');
      btnPremium.addEventListener('click', () => {
        window.location.href = 'premium.html';
      });
    }

    /* ------------------------------------------------------------------
     * Back button handler.
     * On pages where a button with class "btn-back" exists (e.g. the
     * stars or packages pages), we override its click behavior to
     * navigate back to the home page.  This avoids hard‑coding
     * file names in the HTML (like "index (3).html").  If the button is
     * absent, this code does nothing.
     */
    const btnBack = document.querySelector('.btn-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    /* ------------------------------------------------------------------
     * Mobile navigation toggle (if present).
     * Some pages might include a hamburger icon with id="burger" and a
     * menu container with id="menu".  This code toggles the menu open
     * and closed.  It will do nothing on pages where these elements
     * don’t exist.
     */
    const burger = document.getElementById('burger');
    const menu   = document.getElementById('menu');
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', (e) => {
        // Close the menu if clicking outside of it when it's open
        if (!menu.classList.contains('open')) return;
        const within = menu.contains(e.target) || burger.contains(e.target);
        if (!within) menu.classList.remove('open');
      });
    }

    /* ------------------------------------------------------------------
     * Card reveal animations.
     * Cards inside a .grid element are animated in one after another by
     * staggering the CSS animation-delay.  This gives a subtle entrance
     * effect when the page loads.  We run this on all pages that
     * contain a grid of cards.
     */
    const gridCards = document.querySelectorAll('.grid .card');
    gridCards.forEach((card, i) => {
      card.style.animationDelay = (i * 70) + 'ms';
    });

    /* ------------------------------------------------------------------
     * Ripple effect on buttons.
     * Creates a radial ripple on click.  Buttons that use this effect
     * should have the class "btn".  The ripple is removed after the
     * animation completes.
     */
    function makeRipple(e, btn) {
      const rect = btn.getBoundingClientRect();
      const r    = Math.max(rect.width, rect.height);
      const x    = e.clientX - rect.left - r / 2;
      const y    = e.clientY - rect.top  - r / 2;
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width  = span.style.height = r + 'px';
      span.style.left   = x + 'px';
      span.style.top    = y + 'px';
      btn.appendChild(span);
      setTimeout(() => span.remove(), 650);
    }

    /* ------------------------------------------------------------------
     * Purchase modal logic.
     * When a user clicks on a "buy" button, we show a modal asking for
     * their Telegram username and a screenshot of their payment.  The
     * modal is reused across different pages and types of purchases
     * (stars, packages and premium).  We keep track of the current
     * selection using the currentOrder object.
     */
    let currentOrder = null;

    function handlePurchase(data) {
      // data is the dataset object from the clicked card.  It may
      // include desc (description), stars or duration along with price.
      const price = data.price || '0';
      if (price === '0') {
        // Special case: if price is zero (e.g. custom package) we redirect
        // to the Telegram support chat instead of opening the modal.
        window.open('https://t.me/echohex', '_blank');
        return;
      }

      // Save the current order details for submission later.
      currentOrder = {
        desc: data.desc || data.duration || null,
        stars: data.stars || null,
        price: price
      };

      // Prepare modal contents based on what is being purchased
      const modal       = document.getElementById('orderModal');
      const modalText   = document.getElementById('modalText');
      const modalAmount = document.getElementById('modalAmount');
      const priceString = Number(price).toLocaleString('ru-RU');

      if (currentOrder.stars && !currentOrder.desc) {
        modalText.textContent = `Отлично! Вы выбираете ${currentOrder.stars} ⭐ за ${priceString} сум.`;
      } else {
        const descriptor = currentOrder.desc || 'товар';
        modalText.textContent = `Отлично! Вы выбираете ${descriptor} за ${priceString} сум.`;
      }
      modalAmount.textContent = `${priceString} сум`;
      // Reset input fields
      const usernameInput = document.getElementById('orderUsername');
      const fileInput     = document.getElementById('orderScreenshot');
      if (usernameInput) usernameInput.value = '';
      if (fileInput)     fileInput.value     = '';
      // Show modal
      modal?.removeAttribute('hidden');
      // Countdown is triggered after the user clicks the confirm button
    }

    // Attach click handlers to all buy buttons
    document.querySelectorAll('.buy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        makeRipple(e, btn);
        const card = btn.closest('.card');
        if (!card) return;
        handlePurchase(card.dataset);
      });
    });

    // Modal cancel button
    const cancelBtn = document.getElementById('cancelOrder');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.getElementById('orderModal')?.setAttribute('hidden', '');
      });
    }

    // Modal confirm button
    const confirmBtn = document.getElementById('confirmOrder');
    // Timer variable for confirm button countdown
    let confirmCountdownInterval = null;

    // Flag indicating whether a submission is currently in progress. Used to prevent
    // multiple rapid clicks on the confirm button from sending duplicate orders.
    let isSubmitting = false;

    /**
     * Starts a countdown on the "Confirm" button to prevent immediate submission.
     * Disables the button for 10 seconds and updates its text with the remaining
     * seconds. When the countdown ends, the button text is restored and re-enabled.
     * If called again while a countdown is running, the existing timer is cleared.
     */
    function startConfirmCountdown() {
      // Only run if the confirm button exists
      if (!confirmBtn) return;
      // Clear any previous countdown
      if (confirmCountdownInterval) {
        clearInterval(confirmCountdownInterval);
        confirmCountdownInterval = null;
      }
      // Save the original button text so we can restore it
      const originalText = confirmBtn.dataset.originalText || confirmBtn.textContent;
      confirmBtn.dataset.originalText = originalText;
      // Disable the button and set initial countdown value
      let remaining = 10;
      confirmBtn.disabled = true;
      confirmBtn.textContent = `${originalText} (${remaining})`;
      // Set up interval to update the text each second
      confirmCountdownInterval = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          confirmBtn.textContent = `${originalText} (${remaining})`;
        } else {
          // When countdown ends, clear interval, enable button and restore text
          clearInterval(confirmCountdownInterval);
          confirmCountdownInterval = null;
          confirmBtn.disabled = false;
          confirmBtn.textContent = originalText;
        }
      }, 1000);
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        // If a submission is already in progress or the button is disabled due to cooldown, ignore the click
        if (isSubmitting || confirmBtn.disabled) {
          return;
        }
        // Mark that a submission is now in progress
        isSubmitting = true;
        const usernameInput = document.getElementById('orderUsername');
        const fileInput     = document.getElementById('orderScreenshot');
        // Remove leading @ from username if present.  The server will add @
        // back when composing the message.
        let username = usernameInput?.value.trim() || '';
        if (username.startsWith('@')) {
          username = username.slice(1);
        }
        if (!username) {
          alert('Укажите ваш @username.');
          // Reset the submission flag since validation failed
          isSubmitting = false;
          return;
        }
        if (!fileInput || fileInput.files.length === 0) {
          alert('Загрузите скриншот.');
          // Reset the submission flag since validation failed
          isSubmitting = false;
          return;
        }
        // At this point the input is valid; start the 10-second cooldown timer on the confirm button
        startConfirmCountdown();
        // Build form data.  We include only the fields that exist for the current order.
        const form = new FormData();
        if (currentOrder?.desc)  form.append('description', currentOrder.desc);
        if (currentOrder?.stars) form.append('stars', currentOrder.stars);
        form.append('price', currentOrder?.price || '0');
        form.append('username', username);
        form.append('screenshot', fileInput.files[0]);
        // Capture recipient information.  The input may contain a Telegram username
        // starting with @ or a numeric ID.  We strip the @ prefix and send
        // appropriate fields to the server.
        const recipientInput = document.getElementById('orderRecipient');
        if (recipientInput && recipientInput.value) {
          let rec = recipientInput.value.trim();
          if (rec) {
            if (rec.startsWith('@')) {
              rec = rec.slice(1);
              if (rec) form.append('recipientUsername', rec);
            } else {
              form.append('recipientId', rec);
            }
          }
        }
        // Attempt to attach the buyer's numeric Telegram ID (if inside a Telegram WebApp).
        // Some environments may not have window.Telegram defined; guard accordingly.
        try {
          const buyerId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
          if (buyerId) {
            form.append('buyerId', String(buyerId));
          }
        } catch (e) {
          // Ignore any errors retrieving Telegram user ID.
        }
        try {
        // Send order data to our API server.  Use a relative URL so that
        // the front‑end works correctly when deployed on Render or any
        // other host.  Render automatically proxies requests to the
        // correct internal port, so specifying localhost and a port
        // number would break the connection on production.
        const apiEndpoint = '/api/order';
          const resp   = await fetch(apiEndpoint, { method: 'POST', body: form });
          let result;
          try { result = await resp.json(); } catch { result = { success: resp.ok }; }
          if (!resp.ok || !result.success) throw new Error(result.error || 'Ошибка');
          alert('✅ Заказ принят! Вскоре свяжемся.');
        } catch (err) {
          console.error(err);
          alert('❌ Не удалось отправить заказ. Попробуйте позже.');
        } finally {
          document.getElementById('orderModal')?.setAttribute('hidden', '');
          // Allow new submissions after the current one finishes (cooldown still controls button state)
          isSubmitting = false;
        }
      });
    }

    /* ------------------------------------------------------------------
     * Particle background effect
     * Implements a lightweight particle animation on a canvas element
     * with id="bg".  If no such canvas exists on the page, nothing runs.
     */
    const bgCanvas = document.getElementById('bg');
    if (bgCanvas) {
      const ctx = bgCanvas.getContext('2d', { alpha: true });
      let w, h, dpr, particles, mouse = { x: -1e9, y: -1e9 };
      const OPTS = {
        count: 70,
        minR: 0.6,
        maxR: 2.2,
        minV: 0.08,
        maxV: 0.35,
        linkDist: 120,
        linkAlpha: 0.18,
        pull: 0.015
      };
      function rand(a, b) { return a + Math.random() * (b - a); }
      function init() {
        particles = Array.from({ length: OPTS.count }, () => ({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(OPTS.minR * dpr, OPTS.maxR * dpr),
          vx: rand(-OPTS.maxV, OPTS.maxV),
          vy: rand(-OPTS.maxV, OPTS.maxV)
        }));
      }
      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w   = bgCanvas.width  = Math.floor(innerWidth  * dpr);
        h   = bgCanvas.height = Math.floor(innerHeight * dpr);
        bgCanvas.style.width  = innerWidth  + 'px';
        bgCanvas.style.height = innerHeight + 'px';
        init();
      }
      function step() {
        ctx.clearRect(0, 0, w, h);
        // Draw links between nearby particles
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i], b = particles[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const dist = Math.hypot(dx, dy);
            if (dist < OPTS.linkDist * dpr) {
              const alpha = (1 - dist / (OPTS.linkDist * dpr)) * OPTS.linkAlpha;
              ctx.strokeStyle = `rgba(108,92,231,${alpha})`;
              ctx.lineWidth  = dpr * 0.6;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
        // Update and draw particles
        for (const p of particles) {
          // gentle attraction to the mouse
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          const md  = Math.hypot(mdx, mdy);
          if (md < 180 * dpr) {
            p.vx += (mdx / (md + 0.001)) * OPTS.pull;
            p.vy += (mdy / (md + 0.001)) * OPTS.pull;
          }
          p.x += p.vx * dpr;
          p.y += p.vy * dpr;
          // bounce off walls
          if (p.x < 0)      { p.x = 0; p.vx *= -1; }
          else if (p.x > w) { p.x = w; p.vx *= -1; }
          if (p.y < 0)      { p.y = 0; p.vy *= -1; }
          else if (p.y > h) { p.y = h; p.vy *= -1; }
          // draw point
          ctx.fillStyle = 'rgba(108,92,231,.8)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        requestAnimationFrame(step);
      }
      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', e => {
        const rect = bgCanvas.getBoundingClientRect();
        // scale mouse coordinates to the canvas DPR
        mouse.x = (e.clientX - rect.left) * dpr;
        mouse.y = (e.clientY - rect.top)  * dpr;
      }, { passive: true });
      resize();
      step();
    }
  });
})();
