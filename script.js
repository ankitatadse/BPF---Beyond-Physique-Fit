
  // =============================================
  // CONFIGURATION — Replace with your actual keys
  // =============================================
  const CONFIG = {
    RAZORPAY_KEY_ID: 'rzp_test_T51uJnCFnhJDxf',  // Replace with your Razorpay Key ID
    MAKE_WEBHOOK_URL: 'https://hook.eu1.make.com/9s4a6xiy23uq5h8dhhcs1gjs19vlqsji',  // Replace with your Make.com webhook URL
    BREVO_SENDER_NAME: '100 People. 100 Days.',
    BUSINESS_NAME: '100 People. 100 Days. Real Results.',
    BUSINESS_EMAIL: 'hello@100people100days.com',
  };

  // Maps the exact text shown in the "Select a plan" dropdown to the
  // values openModal() needs (must match the pricing card buttons below).
  const PLAN_MAP = {
    '100 Days — ₹999': { name: '100 Days', price: '₹999', amount: '999' },
    '6 Months — ₹14,999': { name: '6 Months', price: '₹14,999', amount: '14999' },
    '12 Months — ₹19,999': { name: '12 Months', price: '₹19,999', amount: '19999' },
  };

  // =============================================
  // SCROLL REVEAL ANIMATION
  // =============================================
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));

  // =============================================
  // STICKY CTA HIDE/SHOW
  // =============================================
  const stickyCta = document.getElementById('sticky-cta');
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
  // PAYMENT MODAL
  // =============================================
  let currentPlan = { name: '', price: '', amount: 0 };

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

    // 1. Create the order server-side (amount/currency are set by the
    //    backend from a trusted source — never trust amount from the client
    //    in a real production app; for now we pass currentPlan.amount).
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
        // 2. Verify the signature server-side before trusting the payment.
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

          // Verified — now log it.
          const paymentData = {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            firstName: document.getElementById('fname') ? document.getElementById('fname').value : '',
            email: document.getElementById('email') ? document.getElementById('email').value : '',
            plan: currentPlan.name,
            amount: currentPlan.price,
            timestamp: new Date().toISOString(),
          };
          sendToMake({ type: 'payment_success', ...paymentData });
          closeModal();
          alert('✅ Payment Successful! Check your email for program access.');
        } catch (err) {
          console.error('Verification request failed:', err);
          alert('⚠️ Could not confirm your payment. If money was deducted, contact support with your payment ID: ' + response.razorpay_payment_id);
        }
      },
      prefill: {
        name: '',
        email: document.getElementById('email') ? document.getElementById('email').value : '',
        contact: document.getElementById('phone') ? document.getElementById('phone').value : '',
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
  // MAKE.COM FORM AUTOMATION
  // =============================================
  async function sendToMake(data) {
    // This webhook call triggers your Make scenario which:
    // 1. Adds lead to Brevo contact list
    // 2. Sends welcome email via Brevo
    // 3. Creates folder in Google Drive
    // 4. Logs entry in Google Sheets
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

    const formData = {
      type: 'new_application',
      firstName: document.getElementById('fname').value,
      lastName: document.getElementById('lname').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      age: document.getElementById('age').value,
      city: document.getElementById('city').value,
      gender: document.getElementById('gender').value,
      foodPreference: document.getElementById('foodPreference').value,
      workoutType: document.getElementById('workoutType').value,
      goal: document.getElementById('goal').value,
      plan: document.getElementById('plan').value,
      amount: PLAN_MAP[document.getElementById('plan').value] ? PLAN_MAP[document.getElementById('plan').value].price : '',
      commitment: document.getElementById('commitment').value,
      submittedAt: new Date().toISOString(),
      source: 'website-apply-form',
    };

    // Send to Make.com which will:
    // → Add to Brevo contact list & send welcome email
    // → Create applicant folder in Google Drive
    // → Log in Google Sheets database
    await sendToMake(formData);

    // Show success state briefly, then carry them straight into payment
    // for the plan they selected — don't leave them stranded here.
    document.getElementById('apply-form').style.display = 'none';
    document.getElementById('form-success').style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Submit Application →';

    const selectedPlan = PLAN_MAP[formData.plan];
    if (selectedPlan) {
      setTimeout(() => {
        openModal(selectedPlan.name, selectedPlan.price, selectedPlan.amount);
      }, 1500); // brief pause so they see the "submitted" confirmation first
    }
  }

  // =============================================
  // INTEGRATION SETUP NOTES (for developer)
  // =============================================
  /*
  RAZORPAY SETUP:
  1. Create account at razorpay.com
  2. Go to Settings > API Keys > Generate Key
  3. Replace CONFIG.RAZORPAY_KEY_ID with your live key
  4. Create a backend endpoint to generate order_id:
     POST https://api.razorpay.com/v1/orders
     { amount, currency, receipt }
  5. Verify payment signature on backend using razorpay_signature

  MAKE.COM (Form Automation) SETUP:
  1. Create a new scenario in make.com
  2. Add "Webhooks > Custom Webhook" trigger → copy URL
  3. Replace CONFIG.MAKE_WEBHOOK_URL with your webhook URL
  4. Add modules after webhook:
     → Brevo: Add Contact + Send Transactional Email
     → Google Drive: Create Folder (named after applicant)
     → Google Sheets: Add Row (log all form data)
     → Razorpay: (optional) Create payment link
  5. Map webhook fields to each module

  BREVO (Email + Delivery) SETUP:
  1. Create account at brevo.com
  2. Get API Key from Settings > API Keys
  3. In Make.com Brevo module, add your API key
  4. Create email templates in Brevo for:
     - Welcome / Application Received
     - Payment Confirmed + Program Access
     - Daily/Weekly program updates
  5. Set up a contact list named "100 Days Program"

  GOOGLE DRIVE SETUP:
  1. Connect Google Drive in Make.com
  2. Create a root folder: "100 Days Program — Applicants"
  3. In Make, create sub-folder per applicant: "{Name} — {Date}"
  4. Upload program materials (PDFs, guides) to Drive
  5. Share applicant folder link via Brevo email on payment
  */
