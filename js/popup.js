document.addEventListener("DOMContentLoaded", () => {

    // Set to true to re-enable the cash prize popup later
    // (remember: the markup was fully removed from index.html too —
    // see removed_popup_backup.html — so it needs to be added back
    // in as well, not just flipped on here).
    const POPUP_ENABLED = true;

    const stickyCta = document.querySelector('.floating-cta-wrapper');

    function showStickyCta() {
        if (stickyCta) {
            stickyCta.classList.add('visible');
        }
    }

    const overlay = document.getElementById("launch-popup-overlay");

    if (!POPUP_ENABLED || !overlay) {
        // Popup is turned off (or its markup isn't present) — show the
        // sticky CTA right away instead of waiting for a popup close
        // event that will now never happen.
        showStickyCta();
        return;
    }

    const closeBtn = document.getElementById("popup-close");
    const skipBtn = document.getElementById("popup-skip");
    const joinBtn = document.getElementById("popup-join");

    // Hide initially
    overlay.style.display = "none";

    // Show popup after page loads
    window.addEventListener("load", () => {
        setTimeout(() => {
            overlay.style.display = "flex";
        }, 800);
    });

    function closePopup() {

        overlay.style.opacity = "0";
        overlay.style.transition = "opacity .3s ease";

        setTimeout(() => {
            overlay.style.display = "none";
            overlay.style.opacity = "1";
            showStickyCta();
        }, 300);

    }

    closeBtn.addEventListener("click", closePopup);

    skipBtn.addEventListener("click", closePopup);

    if (joinBtn) {
        joinBtn.addEventListener("click", () => {

            closePopup();

            setTimeout(() => {

                const applySection = document.getElementById("apply");

                if (applySection) {
                    applySection.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }

            }, 350);

        });
    }

});