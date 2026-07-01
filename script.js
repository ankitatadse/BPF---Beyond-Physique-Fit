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
  RAZORPAY_KEY_ID: 'rzp_test_T51uJnCFnhJDxf',
  MAKE_WEBHOOK_URL: 'https://hook.eu1.make.com/9s4a6xiy23uq5h8dhhcs1gjs19vlqsji',
  BREVO_SENDER_NAME: '100 People. 100 Days.',
  BUSINESS_NAME: 'Beyond Physique Fit',
  BUSINESS_EMAIL: 'beyondphysiquefit@gmail.com',
};

const PLAN_MAP = {
  '100 Days — ₹999':      { name: '100 Days',  price: '₹999',    amount: '999' },
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
// =============================================
// STICKY CTA HIDE/SHOW
// =============================================
const stickyCta = document.querySelector('.floating-cta-wrapper');
if (stickyCta) {
  const applySection = document.getElementById('apply');
  const ctaObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      stickyCta.style.opacity = entry.isIntersecting ? '0' : '1';
      stickyCta.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
    });
  }, { threshold: 0.1 });
  if (applySection) ctaObserver.observe(applySection);
}

// =============================================
// LIVE PRICE DISPLAY ON PLAN SELECTION
// =============================================
const planSelect = document.getElementById('plan');
const planPriceDisplay = document.getElementById('plan-price-display');
const premiumFieldsRow = document.getElementById('premium-fields-row');
const weightInput = document.getElementById('weight');
const heightInput = document.getElementById('height');
if (planSelect && planPriceDisplay) {
  planSelect.addEventListener('change', () => {
    const selected = PLAN_MAP[planSelect.value];
    planPriceDisplay.textContent = selected ? `Amount to be paid: ${selected.price}` : '';

    // Show Weight/Height only for 6 & 12 Month plans (₹999 plan journey stays unchanged)
    const isPremium = selected && selected.name !== '100 Days';
    if (premiumFieldsRow) {
      premiumFieldsRow.style.display = isPremium ? 'grid' : 'none';
      if (weightInput) weightInput.required = isPremium;
      if (heightInput) heightInput.required = isPremium;
    }
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
// SELECT PLAN FROM PRICING CARD (₹999 button)
// — scrolls to form and pre-selects the plan
// =============================================
function selectPlan(planName, priceDisplay) {
  // Find the matching plan key in the dropdown
  const planKey = Object.keys(PLAN_MAP).find(k => PLAN_MAP[k].name === planName);

  // Pre-select the plan in the apply form dropdown
  const planDropdown = document.getElementById('plan');
  if (planDropdown && planKey) {
    planDropdown.value = planKey;
    planDropdown.dispatchEvent(new Event('change'));
  }

  // Scroll smoothly to the apply form
  document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
}

// =============================================
// PAYMENT MODAL
// =============================================
let currentPlan = { name: '', price: '', amount: 0 };
let currentFormData = {}; // store form data for use after payment

function openModal(planName, priceDisplay, amountInPaise) {
  currentPlan = { name: planName, price: priceDisplay, amount: parseInt(amountInPaise) * 100 };
  document.getElementById('modal-plan-name').textContent = planName + ' Plan';
  document.getElementById('modal-price-display').textContent = priceDisplay;
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
// RAZORPAY PAYMENT
// =============================================
async function initiateRazorpay() {
  const submitBtn = document.querySelector('.modal-pay-btn, .rzp-btn');
  if (submitBtn) submitBtn.disabled = true;

  let order;
  try {
    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: currentPlan.amount,
        currency: 'INR',
        receipt: 'receipt_' + Date.now(),
      }),
    });
    if (!orderRes.ok) throw new Error('Order creation failed');
    order = await orderRes.json();
  } catch (err) {
    console.error('Could not create order:', err);
    alert('Something went wrong starting your payment. Please try again.');
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  const options = {
    key: CONFIG.RAZORPAY_KEY_ID,
    amount: order.amount,
    currency: order.currency,
    order_id: order.order_id,
    name: CONFIG.BUSINESS_NAME,
    description: '100 Days Transformation Program — ' + currentPlan.name + ' Plan',
    image: '',
    handler: async function(response) {
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
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.valid) {
          alert('⚠️ Payment could not be verified. If money was deducted, contact support with your payment ID: ' + response.razorpay_payment_id);
          return;
        }

        // ✅ Payment verified — send ALL form data + payment data to Make.com
        const paymentData = {
          type: 'payment_success',
          // Payment info
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          // Plan info
          plan: currentPlan.name,
          amount: currentPlan.amount, // sends "999" (number only)
          // Full form data (all user attributes for Brevo)
          firstName: currentFormData.firstName || '',
          lastName: currentFormData.lastName || '',
          email: currentFormData.email || '',
          phone: currentFormData.phone || '',
          age: currentFormData.age || '',
          city: currentFormData.city || '',
          weight: currentFormData.weight || '',
          height: currentFormData.height || '',
          gender: currentFormData.gender || '',           // → GENDER in Brevo
          foodPreference: currentFormData.foodPreference || '', // → FOOD_PREFERENCE in Brevo
          workoutType: currentFormData.workoutType || '', // → WORKOUT_TYPE in Brevo
          goal: currentFormData.goal || '',
          commitment: currentFormData.commitment || '',
          timestamp: new Date().toISOString(),
        };

        await sendToMake(paymentData);
        closeModal();

        if (currentPlan.name === '100 Days') {
          // ₹999 plan — fully handled by Brevo email automation
          document.getElementById('apply-form').style.display = 'none';
          document.getElementById('form-success').style.display = 'block';
          document.getElementById('form-success').innerHTML = `
            <h3>✅ Payment Successful!</h3>
            <p>Welcome to BPF, ${currentFormData.firstName}! 🎉<br>
            Check your email — your Welcome, Nutrition Blueprint, and Workout Plan will arrive in the next few minutes.</p>
          `;
          document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
        } else {
          // 6/12 month plans — confirmation handled automatically via WhatsApp (Make.com + AiSensy)
          document.getElementById('apply-form').style.display = 'none';
          document.getElementById('form-success').style.display = 'block';
          document.getElementById('form-success').innerHTML = `
            <h3>✅ Payment Successful!</h3>
            <p>Welcome to BPF, ${currentFormData.firstName}! 🎉<br>
            You'll receive a confirmation message on WhatsApp shortly with your registration details. Our coaching team will reach out with next steps.</p>
          `;
          document.getElementById('apply').scrollIntoView({ behavior: 'smooth' });
        }

      } catch (err) {
        console.error('Verification request failed:', err);
        alert('⚠️ Could not confirm your payment. If money was deducted, contact support with your payment ID: ' + response.razorpay_payment_id);
      }
    },
    prefill: {
      name: (currentFormData.firstName || '') + ' ' + (currentFormData.lastName || ''),
      email: currentFormData.email || '',
      contact: currentFormData.phone || '',
    },
    notes: {
      program: '100 People 100 Days',
      plan: currentPlan.name,
    },
    theme: { color: '#0D0D0D' },
    modal: {
      ondismiss: function() { console.log('Razorpay modal dismissed'); }
    }
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function(response) {
    alert('Payment failed: ' + response.error.description + '\nPlease try again.');
  });
  rzp.open();
  closeModal();
  if (submitBtn) submitBtn.disabled = false;
}

// =============================================
// MAKE.COM WEBHOOK
// =============================================
async function sendToMake(data) {
  try {
    await fetch('https://hook.eu1.make.com/9s4a6xiy23uq5h8dhhcs1gjs19vlqsji', {
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

  // Final safety check before submitting (in case someone reached step 3 with
  // an invalid value left behind via browser back/forward, autofill, etc.)
  const invalidField = form.querySelector(':invalid');
  if (invalidField) {
    const stepEl = invalidField.closest('.step-panel');
    if (stepEl && window.goToWizardStep) {
      window.goToWizardStep(parseInt(stepEl.dataset.step));
    }
    invalidField.reportValidity();
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  // Save form data globally so initiateRazorpay() can access it
  currentFormData = {
    firstName:      document.getElementById('fname').value.trim(),
    lastName:       document.getElementById('lname').value.trim(),
    email:          document.getElementById('email').value.trim(),
    phone:          document.getElementById('phone').value.trim(),
    age:            document.getElementById('age').value.trim(),
    city:           document.getElementById('city').value.trim(),
    weight:         document.getElementById('weight').value.trim(),
    height:         document.getElementById('height').value.trim(),
    gender:         document.getElementById('gender').value,        // Male / Female
    foodPreference: document.getElementById('foodPreference').value, // Veg / Non-Veg
    workoutType:    document.getElementById('workoutType').value,    // Home Workout / Gym Workout
    goal:           document.getElementById('goal').value,
    plan:           document.getElementById('plan').value,
    commitment:     document.getElementById('commitment').value.trim(),
    submittedAt:    new Date().toISOString(),
    source:         'website-apply-form',
  };

  // Show submitted message
  document.getElementById('apply-form').style.display = 'none';
  document.getElementById('form-success').style.display = 'block';
  btn.disabled = false;
  btn.textContent = 'Submit Application →';

  // After 1.5s — open the payment modal for their chosen plan
  const selectedPlan = PLAN_MAP[currentFormData.plan];
  if (selectedPlan) {
    setTimeout(() => {
      openModal(selectedPlan.name, selectedPlan.price, selectedPlan.amount);
    }, 1500);
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

  // Build dots
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
    dot.addEventListener('click', () => scrollToCard(i));
    carouselDotsWrap.appendChild(dot);
  });
  const dots = Array.from(carouselDotsWrap.children);

  function getCardStep() {
    // Distance to scroll = one card width + the track's gap
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

  // Keep dots in sync with manual scroll/swipe
  let scrollTimeout;
  resultsTrack.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const step = getCardStep();
      const activeIndex = Math.round(resultsTrack.scrollLeft / step);
      dots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
    }, 100);
  });

  // Auto-advance every 5s, pausing on hover/touch
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
// Append this to the END of your existing script.js
// (does not touch or redefine any existing functions —
//  submitForm(), sendToMake(), openModal() etc. stay untouched)
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

  // Guard — only run this logic if the multistep form is actually on the page
  if (!btnNext || !btnBack || !submitBtn) return;

  // Sync pill taps to their hidden <select> so submitForm() needs zero changes
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
    });
  });

  // Plan price preview banner on step 3
  const PLAN_PREVIEW = {
    '100 Days — ₹999':      { name: '100 Days Plan', price: '₹999' },
    '6 Months — ₹14,999':  { name: '6 Months Plan', price: '₹14,999' },
    '12 Months — ₹19,999': { name: '12 Months Plan', price: '₹19,999' },
  };

  const planSelect = document.getElementById('plan');
  if (planSelect) {
    planSelect.addEventListener('change', function() {
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
        el.reportValidity();
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

  // Expose a minimal hook so submitForm() can jump to an invalid step if needed
  window.goToWizardStep = function(step) {
    currentStep = step;
    showStep(step);
  };

  // Initialize on first load
  showStep(1);
})();
