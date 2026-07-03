document.addEventListener("DOMContentLoaded", () => {

    const overlay = document.getElementById("launch-popup-overlay");
    const closeBtn = document.getElementById("popup-close");
    const skipBtn = document.getElementById("popup-skip");
    const joinBtn = document.getElementById("popup-join");

    if (!overlay) return;

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