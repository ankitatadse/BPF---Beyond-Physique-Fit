// Force landing page to always start at top, ignoring any #hash on load
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
window.addEventListener('load', () => {
  window.scrollTo(0, 0);
});

// =============================================
// CONFIGURATION
// =============================================
const CONFIG = {
  MAKE_WEBHOOK_URL: 'https://hook.eu1.make.com/o6htoerdtkqxs9lvplvrlfxatepnp1wb',
  BREVO_SENDER_NAME: '100 People. 12 Weeks.',
  BUSINESS_NAME: 'Beyond Physique Fit',
  BUSINESS_EMAIL: 'beyondphysiquefit@gmail.com',
  // Razorpay Key ID is no longer hardcoded here — it's fetched at runtime
  // from /api/config, which reads it from Vercel's environment variables.
  // This means switching between Test and Live mode only requires updating
  // RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in Vercel — no code change needed.
};

const PLAN_MAP = {
  '12 Weeks — ₹99':       { name: '12 Weeks',  price: '₹99',     amount: '99' },
  '6 Months — ₹14,999':  { name: '6 Months',  price: '₹14,999', amount: '14999' },
  '12 Months — ₹19,999': { name: '12 Months', price: '₹19,999', amount: '19999' },
};

// =============================================
// SCROLL REVEAL ANIMATION
// =============================================
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('revealed');
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

// =============================================
// STICKY CTA HIDE/SHOW
// =============================================
const stickyCta = document.querySelector('.floating-cta-wrapper');
if (stickyCta) {
  const heroSection = document.querySelector('.hero');
  const pricingSection = document.getElementById('pricing');
  const applySection = document.getElementById('apply');

  function sectionInView(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // "in view" = any part of the section overlaps the viewport at all
    return rect.top < vh && rect.bottom > 0;
  }

  function updateStickyCta() {
    const shouldHide = sectionInView(heroSection) || sectionInView(pricingSection) || sectionInView(applySection);
    stickyCta.classList.toggle('cta-hidden', shouldHide);
  }

  let ctaTicking = false;
  window.addEventListener('scroll', () => {
    if (!ctaTicking) {
      window.requestAnimationFrame(() => {
        updateStickyCta();
        ctaTicking = false;
      });
      ctaTicking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateStickyCta);
  updateStickyCta();
}

// =============================================
// LIVE PRICE DISPLAY ON PLAN SELECTION
// =============================================
const planSelect = document.getElementById('plan');
const planPriceDisplay = document.getElementById('plan-price-display');
if (planSelect && planPriceDisplay) {
  planSelect.addEventListener('change', () => {
    const selected = PLAN_MAP[planSelect.value];
    planPriceDisplay.textContent = selected ? `Amount to be paid: ${selected.price}` : '';
  });
}

// =============================================
// HAMBURGER MENU
// =============================================
function toggleMenu(btn) {
  const nav = document.querySelector('.nav-links');
  const isOpen = nav.style.display === 'flex';
  nav.style.display = isOpen ? '' : 'flex';
  nav.style.flexDirection = 'column';
  nav.style.position = 'fixed';
  nav.style.top = '72px';
  nav.style.left = '0';
  nav.style.right = '0';
  nav.style.background = 'white';
  nav.style.padding = '1rem 5%';
  nav.style.borderBottom = '1px solid #eee';
  nav.style.gap = '1.5rem';
  if (isOpen) { nav.style.display = 'none'; }
}

// =============================================
// SELECT PLAN FROM PRICING CARD
// =============================================
function selectPlan(planName, priceDisplay) {
  const planKey = Object.keys(PLAN_MAP).find(k => PLAN_MAP[k].name === planName);
  const planDropdown = document.getElementById('plan');
  if (planDropdown && planKey) {
    planDropdown.value = planKey;
    planDropdown.dispatchEvent(new Event('change'));
  }
  document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
}

// =============================================
// PAYMENT MODAL
// =============================================
let currentPlan = { name: '', price: '', amount: 0 };
let currentFormData = {};

const PLAN_DURATION = {
  '12 Weeks': '12 weeks',
  '6 Months': '180 days',
  '12 Months': '365 days',
};

const PLAN_BULLETS = {
  '12 Weeks': ['Materials delivered via email', 'Diet & workout PDFs sent instantly'],
  '6 Months':  ['Personal onboarding via WhatsApp', 'Coach reaches out within 24 hours'],
  '12 Months': ['Personal onboarding via WhatsApp', 'Coach reaches out within 24 hours'],
};

function openModal(planName, priceDisplay, amountInPaise) {
  currentPlan = { name: planName, price: priceDisplay, amount: parseInt(amountInPaise) * 100 };
  document.getElementById('modal-plan-name').textContent = planName + ' Plan';
  document.getElementById('modal-price-display').textContent = priceDisplay;
  const periodEl = document.getElementById('modal-period-display');
  if (periodEl) periodEl.textContent = 'one-time · ' + (PLAN_DURATION[planName] || '12 weeks');

  const bullets = PLAN_BULLETS[planName] || PLAN_BULLETS['12 Weeks'];
  const b2 = document.getElementById('modal-bullet-2');
  const b3 = document.getElementById('modal-bullet-3');
  if (b2) b2.lastChild.textContent = bullets[0];
  if (b3) b3.lastChild.textContent = bullets[1];

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// =============================================
// RAZORPAY PAYMENT — real Checkout flow via
// /api/create-order + /api/verify-payment.
// Success message + Make webhook (which triggers
// the Brevo emails) only fire AFTER Razorpay
// confirms the payment and the signature verifies.
// =============================================
let _rzpKeyIdCache = null;
async function getRazorpayKeyId() {
  if (_rzpKeyIdCache) return _rzpKeyIdCache;
  const res = await fetch('/api/config');
  const data = await res.json();
  if (!res.ok || !data.key_id) throw new Error(data.error || 'Could not load payment configuration');
  _rzpKeyIdCache = data.key_id;
  return _rzpKeyIdCache;
}

async function initiateRazorpay() {
  const payBtn = document.querySelector('#modal .rzp-btn');
  if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Preparing secure checkout…'; }

  try {
    // 0) Get the current public Key ID (test or live, whatever Vercel has set).
    const keyId = await getRazorpayKeyId();

    // 1) Create a real Razorpay order server-side for the exact plan amount.
    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: currentPlan.amount, // already in paise
        currency: 'INR',
        receipt: `bpf_${currentPlan.name.replace(/\s+/g, '')}_${Date.now()}`,
      }),
    });
    const order = await orderRes.json();

    if (!orderRes.ok || !order.order_id) {
      throw new Error(order.error || 'Could not create order');
    }

    if (payBtn) { payBtn.disabled = false; payBtn.textContent = '💳 Pay Securely with Razorpay'; }

    // 2) Open Razorpay's embedded Checkout (not a new tab / static link).
    const rzp = new Razorpay({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: CONFIG.BUSINESS_NAME,
      description: `${currentPlan.name} Plan`,
      order_id: order.order_id,
      prefill: {
        name: `${currentFormData.firstName || ''} ${currentFormData.lastName || ''}`.trim(),
        email: currentFormData.email || '',
        contact: currentFormData.phone || '',
      },
      theme: { color: '#083234' },
      handler: async function (response) {
        await handleConfirmedPayment(response, order);
      },
      modal: {
        ondismiss: function () {
          // User closed the checkout without paying — do NOT show a success
          // message and do NOT notify Make. Just re-enable the button.
          if (payBtn) { payBtn.disabled = false; payBtn.textContent = '💳 Pay Securely with Razorpay'; }
        },
      },
    });

    rzp.on('payment.failed', function (response) {
      alert('Payment failed: ' + (response.error && response.error.description ? response.error.description : 'Please try again.'));
    });

    closeModal();
    rzp.open();

  } catch (err) {
    console.error('Razorpay init error:', err);
    if (payBtn) { payBtn.disabled = false; payBtn.textContent = '💳 Pay Securely with Razorpay'; }
    alert('Something went wrong starting the payment. Please try again in a moment.');
  }
}

// =============================================
// POST-PAYMENT: verify signature server-side,
// THEN (and only then) notify Make.com and show
// the success UI / WhatsApp redirect.
// =============================================
async function handleConfirmedPayment(response, order) {
  try {
    const verifyRes = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
    });
    const verification = await verifyRes.json();

    if (!verifyRes.ok || !verification.valid) {
      alert('We could not verify your payment. If money was deducted, please contact us at ' + CONFIG.BUSINESS_EMAIL + ' with your payment ID: ' + response.razorpay_payment_id);
      return;
    }

    // Payment is confirmed genuine — now (and only now) log it + trigger emails.
    sendToMake({
      type: 'payment_success',
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_order_id: response.razorpay_order_id,
      razorpay_signature: response.razorpay_signature,
      plan: currentPlan.name,
      amount: (order.amount / 100).toString(),
      firstName: currentFormData.firstName || '',
      lastName: currentFormData.lastName || '',
      email: currentFormData.email || '',
      phone: currentFormData.phone || '',
      age: currentFormData.age || '',
      city: currentFormData.city || '',
      weight: currentFormData.weight || '',
      height: currentFormData.height || '',
      gender: currentFormData.gender || '',
      foodPreference: currentFormData.foodPreference || '',
      workoutType: currentFormData.workoutType || '',
      goal: currentFormData.goal || '',
      medical: currentFormData.medical || '',
      commitment: currentFormData.commitment || '',
      timestamp: new Date().toISOString(),
    });

    document.getElementById('apply-form').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';

    if (currentPlan.name === '12 Weeks') {
      document.getElementById('form-success').innerHTML = `
        <h3>✅ Payment Successful!</h3>
        <p>Welcome to BPF, ${currentFormData.firstName}! 🎉<br>
        Your Welcome email, Nutrition Blueprint, and Workout Plan will arrive in your inbox shortly.</p>
      `;
      document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
    } else {
      const planLabel = currentPlan.name === '6 Months'
        ? '6 Months Transformation Plan (₹14,999)'
        : '12 Months Transformation Plan (₹19,999)';

      const msg = `Hi! I just paid for the ${planLabel}. Here are my details:

Name: ${currentFormData.firstName} ${currentFormData.lastName}
Age: ${currentFormData.age}
Gender: ${currentFormData.gender}
Height: ${currentFormData.height} cm
Weight: ${currentFormData.weight} kg
Goal: ${currentFormData.goal}
Medical Conditions: ${currentFormData.medical || 'None'}
City: ${currentFormData.city}
Phone Number: ${currentFormData.phone}
Email: ${currentFormData.email}
Payment ID: ${response.razorpay_payment_id}

Looking forward to getting started! 💪`;

      const waNumber = '917028444813';
      const waURL = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

      document.getElementById('form-success').innerHTML = `
        <h3>✅ Payment Successful!</h3>
        <p>Welcome to BPF, ${currentFormData.firstName}! 🎉<br>
        Opening WhatsApp now so our coach can get your plan started.</p>
      `;
     document.getElementById("form-success").innerHTML += `
    <div style="margin-top:20px;text-align:center;">
        <a
            href="${waURL}"
            target="_blank"
            style="
                display:inline-block;
                background:#CDFF00;
                color:#111;
                padding:12px 24px;
                border-radius:8px;
                font-weight:700;
                text-decoration:none;
            "
        >
            👉 Open WhatsApp
        </a>
    </div>
`;
    }
  } catch (err) {
    console.error('Post-payment handling error:', err);
    alert('Your payment went through, but we hit an error finishing setup. Please contact us at ' + CONFIG.BUSINESS_EMAIL + ' with payment ID: ' + response.razorpay_payment_id);
  }
}

// =============================================
// MAKE.COM WEBHOOK
// =============================================
async function sendToMake(data) {
  try {
    await fetch(CONFIG.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.error('Make webhook error:', err);
  }
}

// =============================================
// APPLY FORM SUBMISSION
// =============================================
async function submitForm(e) {
  e.preventDefault();
  const form = document.getElementById('apply-form');

  try {
    const invalidField = form.querySelector(':invalid');
    if (invalidField) {
      const stepEl = invalidField.closest('.step-panel');
      if (stepEl && window.goToWizardStep) {
        window.goToWizardStep(parseInt(stepEl.dataset.step));
      }
      if (window.showFieldError) {
        window.showFieldError(invalidField);
      } else {
        invalidField.reportValidity();
      }
      return;
    }

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    currentFormData = {
      firstName:      document.getElementById('fname').value.trim(),
      lastName:       document.getElementById('lname').value.trim(),
      email:          document.getElementById('email').value.trim(),
      phone:          document.getElementById('phone').value.trim(),
      age:            document.getElementById('age').value.trim(),
      city:           document.getElementById('city').value.trim(),
      weight:         document.getElementById('weight').value.trim(),
      height:         document.getElementById('height').value.trim(),
      gender:         document.getElementById('gender').value,
      foodPreference: document.getElementById('foodPreference').value,
      workoutType:    document.getElementById('workoutType').value,
      goal:           document.getElementById('goal').value,
      plan:           document.getElementById('plan').value,
      medical:        document.getElementById('medical') ? document.getElementById('medical').value.trim() : '',
      commitment:     document.getElementById('commitment').value.trim(),
      submittedAt:    new Date().toISOString(),
      source:         'website-apply-form',
    };

    btn.disabled = false;
    btn.textContent = 'Submit & Pay';

    const selectedPlan = PLAN_MAP[currentFormData.plan];
    if (selectedPlan) {
      setTimeout(() => {
        openModal(selectedPlan.name, selectedPlan.price, selectedPlan.amount);
      }, 300);
    } else {
      console.error('No matching plan found for:', currentFormData.plan);
      alert('Something went wrong reading your selected plan. Please re-select your plan and try again.');
    }
  } catch (err) {
    console.error('submitForm error:', err);
    const btn = document.getElementById('submit-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit & Pay'; }
    alert('Something went wrong submitting the form. Please try again, or contact us if this keeps happening.');
  }
}

// =============================================
// PARTICLES
// =============================================
const particles = document.querySelector('.particles');
if (particles) {
  setInterval(() => {
    const p = document.createElement('span');
    p.style.left = Math.random() * 80 + 'px';
    p.style.bottom = '0px';
    p.style.animationDuration = (2 + Math.random() * 2) + 's';
    particles.appendChild(p);
    setTimeout(() => { p.remove(); }, 4000);
  }, 300);
}

// =============================================
// TESTIMONIALS CAROUSEL
// =============================================
const resultsTrack = document.getElementById('results-track');
const carouselDotsWrap = document.getElementById('carousel-dots');

if (resultsTrack && carouselDotsWrap) {
  const cards = Array.from(resultsTrack.children);

  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
    dot.addEventListener('click', () => scrollToCard(i));
    carouselDotsWrap.appendChild(dot);
  });
  const dots = Array.from(carouselDotsWrap.children);

  function getCardStep() {
    const gap = parseFloat(getComputedStyle(resultsTrack).gap) || 0;
    return cards[0].getBoundingClientRect().width + gap;
  }

  function scrollToCard(index) {
    const clamped = Math.max(0, Math.min(index, cards.length - 1));
    resultsTrack.scrollTo({ left: clamped * getCardStep(), behavior: 'smooth' });
  }

  window.moveCarousel = function(direction) {
    const step = getCardStep();
    const nextLeft = resultsTrack.scrollLeft + direction * step;
    resultsTrack.scrollTo({ left: nextLeft, behavior: 'smooth' });
  };

  let scrollTimeout;
  resultsTrack.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const step = getCardStep();
      const activeIndex = Math.round(resultsTrack.scrollLeft / step);
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
    }, 100);
  });

  let autoplay = setInterval(() => {
    const atEnd = resultsTrack.scrollLeft + resultsTrack.clientWidth >= resultsTrack.scrollWidth - 10;
    atEnd ? scrollToCard(0) : window.moveCarousel(1);
  }, 5000);

  const wrapper = resultsTrack.closest('.carousel-wrapper');
  if (wrapper) {
    wrapper.addEventListener('mouseenter', () => clearInterval(autoplay));
    wrapper.addEventListener('touchstart', () => clearInterval(autoplay), { passive: true });
  }
}

// =============================================
// MULTISTEP APPLY FORM LOGIC
// =============================================
(function() {
  let currentStep = 1;
  const totalSteps = 3;

  const segs = {
    1: document.getElementById('seg-1'),
    2: document.getElementById('seg-2'),
    3: document.getElementById('seg-3'),
  };
  const progressText = document.getElementById('progress-text');
  const progressPct = document.getElementById('progress-pct');
  const btnNext = document.getElementById('btn-next');
  const btnBack = document.getElementById('btn-back');
  const submitBtn = document.getElementById('submit-btn');

  if (!btnNext || !btnBack || !submitBtn) return;

  function clearFieldError(fieldId) {
    const group = document.querySelector(`.pill-group[data-syncs="${fieldId}"]`);
    if (group) group.classList.remove('field-error');
    const msg = document.querySelector(`.field-error-msg[data-error-for="${fieldId}"]`);
    if (msg) msg.classList.remove('visible');
  }

  function showFieldError(el) {
    // Native browser validation tooltips can't be seen on our visually-hidden
    // <select> elements (they're 1px/opacity:0 for the pill-button UI), so for
    // those we show a real, visible error on the pill buttons instead.
    if (el.tagName === 'SELECT' && el.classList.contains('hidden-select')) {
      const group = document.querySelector(`.pill-group[data-syncs="${el.id}"]`);
      const msg = document.querySelector(`.field-error-msg[data-error-for="${el.id}"]`);
      if (group) {
        group.classList.remove('field-error');
        void group.offsetWidth; // restart animation if triggered twice in a row
        group.classList.add('field-error');
        group.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (msg) msg.classList.add('visible');
      return;
    }
    el.reportValidity();
  }

  document.querySelectorAll('.pill-group').forEach(group => {
    const targetId = group.dataset.syncs;
    const select = document.getElementById(targetId);
    if (!select) return;
    group.addEventListener('click', (e) => {
      const opt = e.target.closest('.pill-option');
      if (!opt) return;
      group.querySelectorAll('.pill-option').forEach(p => p.classList.remove('selected'));
      opt.classList.add('selected');
      select.value = opt.dataset.value;
      clearFieldError(targetId);
    });
  });

  const PLAN_PREVIEW = {
    '12 Weeks — ₹99':       { name: '12 Weeks Plan', price: '₹99' },
    '6 Months — ₹14,999':  { name: '6 Months Plan', price: '₹14,999' },
    '12 Months — ₹19,999': { name: '12 Months Plan', price: '₹19,999' },
  };

  const planSelectEl = document.getElementById('plan');
  if (planSelectEl) {
    planSelectEl.addEventListener('change', function() {
      const sel = PLAN_PREVIEW[this.value];
      const banner = document.getElementById('apply-plan-banner');
      if (!banner) return;
      if (sel) {
        document.getElementById('pb-name').textContent = sel.name;
        document.getElementById('pb-price').textContent = sel.price;
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    });
  }

  function fieldsValidForStep(step) {
    const panel = document.querySelector(`.step-panel[data-step="${step}"]`);
    if (!panel) return true;
    const inputs = panel.querySelectorAll('input[required], select[required]');
    for (const el of inputs) {
      if (!el.checkValidity()) {
        showFieldError(el);
        return false;
      }
    }
    return true;
  }

  function updateProgress() {
    for (let i = 1; i <= totalSteps; i++) {
      if (!segs[i]) continue;
      segs[i].classList.remove('active', 'done');
      if (i < currentStep) segs[i].classList.add('done');
      else if (i === currentStep) segs[i].classList.add('active');
    }
    if (progressText) progressText.textContent = `Step ${currentStep} of ${totalSteps}`;
    if (progressPct) progressPct.textContent = Math.round((currentStep / totalSteps) * 100) + '%';
  }

  function showStep(step) {
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const target = document.querySelector(`.step-panel[data-step="${step}"]`);
    if (target) target.classList.add('active');

    btnBack.style.display = step === 1 ? 'none' : 'block';

    if (step === totalSteps) {
      btnNext.style.display = 'none';
      submitBtn.style.display = 'block';
    } else {
      btnNext.style.display = 'block';
      submitBtn.style.display = 'none';
    }

    updateProgress();

    const card = document.querySelector('.step-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  btnNext.addEventListener('click', () => {
    if (!fieldsValidForStep(currentStep)) return;
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    }
  });

  btnBack.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });

  window.showFieldError = showFieldError;

  window.goToWizardStep = function(step) {
    currentStep = step;
    showStep(step);
  };

  showStep(1);
})();