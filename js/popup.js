document.addEventListener("DOMContentLoaded", () => {

    // Set to true to re-enable the cash prize popup later.
    const POPUP_ENABLED = false;

    const overlay = document.getElementById("launch-popup-overlay");
    const closeBtn = document.getElementById("popup-close");
    const skipBtn = document.getElementById("popup-skip");
    const joinBtn = document.getElementById("popup-join");
    const stickyCta = document.querySelector('.floating-cta-wrapper');

    if (!overlay) return;

    // Hide initially
    overlay.style.display = "none";

    function showStickyCta() {
        if (stickyCta) {
            stickyCta.classList.add('visible');
        }
    }

    if (!POPUP_ENABLED) {
        // Popup is turned off — show the sticky CTA right away instead of
        // waiting for a popup close event that will now never happen.
        showStickyCta();
        return;
    }

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