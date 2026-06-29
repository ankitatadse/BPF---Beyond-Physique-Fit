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
const stickyCta = document.getElementById('sticky-cta');
if (stickyCta) {
  window.addEventListener('scroll', () => {
    const applySection = document.getElementById('apply');
    const applyRect = applySection.getBoundingClientRect();
    if (applyRect.top < window.innerHeight && applyRect.bottom > 0) {
      stickyCta.style.opacity = '0';
      stickyCta.style.pointerEvents = 'none';
    } else {
      stickyCta.style.opacity = '1';
      stickyCta.style.pointerEvents = 'auto';
    }
  });
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
    // Trigger the price display update
    if (planPriceDisplay) {
      planPriceDisplay.textContent = `Amount to be paid: ${priceDisplay}`;
    }
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
          // 6/12 month plans — redirect to WhatsApp
          const waNumber = '917028444813';
          const waMessage = encodeURIComponent(
            `Hi! I just paid for the ${currentPlan.name} plan (${currentPlan.price}). My name is ${paymentData.firstName}, email: ${paymentData.email}. Looking forward to getting started!`
          );
          window.location.href = `https://wa.me/${waNumber}?text=${waMessage}`;
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