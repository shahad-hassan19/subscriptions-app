/**
 * subscription-widget.js
 *
 * HOW TO INSTALL IN A SHOPIFY THEME:
 *
 * 1. In your Shopify admin → Online Store → Themes → Edit code
 * 2. Create a new snippet: snippets/subscription-widget.liquid
 * 3. Paste the liquid wrapper (subscription-widget.liquid) there
 * 4. In your product.liquid or product-template.liquid, include the snippet:
 *      {% render 'subscription-widget', product: product %}
 * 5. Upload this JS file to your theme's Assets folder as subscription-widget.js
 *
 * HOW IT WORKS:
 * 1. Widget initialises on page load, reads shopId + appUrl from data attributes
 * 2. Fetches active billing plans from your API (/api/billing-plans/public?shopId=xxx)
 * 3. Renders a "Purchase options" UI below the buy button:
 *      ○ One-time purchase   $29.99
 *      ● Subscribe monthly   $26.99  (save 10%) ← selected by default
 *      ○ Subscribe weekly    $27.99  (save 7%)
 * 4. When the customer clicks "Subscribe", we redirect them to:
 *      https://your-portal.com/login?shopId=xxx&variantId=yyy&planId=zzz
 *    (In a full integration you'd hook into the Add to Cart flow instead)
 */

(function () {
  "use strict";

  // ── Config ───────────────────────────────────────────────────────────────
  // These are injected by the Liquid snippet via data attributes on the container.

  const CONTAINER_ID = "subs-widget";

  // ── Bootstrap ────────────────────────────────────────────────────────────

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return; // Not on a product page

    const shopId = container.dataset.shopId;
    const appUrl = container.dataset.appUrl; // your server URL
    const portalUrl = container.dataset.portalUrl; // customer portal URL
    const variantId = container.dataset.variantId; // Shopify variant ID
    const price = parseFloat(container.dataset.price ?? "0");

    if (!shopId || !appUrl) {
      console.warn("[subs-widget] Missing shopId or appUrl data attributes");
      return;
    }

    loadPlans(appUrl, shopId)
      .then((plans) =>
        render(container, plans, { shopId, portalUrl, variantId, price }),
      )
      .catch((err) => console.warn("[subs-widget] Failed to load plans:", err));
  }

  // ── Fetch billing plans ───────────────────────────────────────────────────

  async function loadPlans(appUrl, shopId) {
    const res = await fetch(
      `${appUrl}/api/billing-plans/public?shopId=${shopId}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.plans ?? [];
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(container, plans, { shopId, portalUrl, variantId, price }) {
    if (plans.length === 0) return; // No plans — don't show the widget

    // Start with one-time purchase selected
    let selectedPlanId = null; // null = one-time

    container.innerHTML = `
        <div class="subs-widget" style="
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          margin: 16px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
        ">
          <p style="font-weight: 600; margin: 0 0 12px; color: #111;">Purchase options</p>
  
          <div id="subs-options" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- One-time purchase -->
            <label id="subs-opt-onetime" style="
              display: flex; align-items: center; justify-content: space-between;
              border: 2px solid #e5e7eb; border-radius: 8px; padding: 10px 12px;
              cursor: pointer; transition: border-color 0.15s;
            ">
              <div style="display: flex; align-items: center; gap: 10px;">
                <input type="radio" name="subs-plan" value="onetime" checked
                  style="accent-color: #111; width: 16px; height: 16px;" />
                <span style="color: #374151;">One-time purchase</span>
              </div>
              <span style="font-weight: 600; color: #111;">$${price.toFixed(2)}</span>
            </label>
  
            <!-- Subscription plans -->
            ${plans
              .map((plan, i) => {
                const discounted = calcDiscount(price, plan);
                const saving = price - discounted;
                const interval = `${plan.intervalCount > 1 ? plan.intervalCount + " " : ""}${plan.intervalUnit.toLowerCase()}${plan.intervalCount > 1 ? "s" : ""}`;

                return `
                <label id="subs-opt-${plan.id}" style="
                  display: flex; align-items: center; justify-content: space-between;
                  border: 2px solid #e5e7eb; border-radius: 8px; padding: 10px 12px;
                  cursor: pointer; transition: border-color 0.15s;
                ">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="radio" name="subs-plan" value="${plan.id}"
                      style="accent-color: #111; width: 16px; height: 16px;" />
                    <div>
                      <div style="color: #374151;">Subscribe — every ${interval}</div>
                      ${plan.description ? `<div style="color: #9ca3af; font-size: 12px;">${plan.description}</div>` : ""}
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0; margin-left: 8px;">
                    <div style="font-weight: 600; color: #111;">$${discounted.toFixed(2)}</div>
                    ${saving > 0 ? `<div style="color: #16a34a; font-size: 12px;">save $${saving.toFixed(2)}</div>` : ""}
                  </div>
                </label>
              `;
              })
              .join("")}
          </div>
  
          <!-- Subscribe CTA (hidden when one-time is selected) -->
          <div id="subs-cta" style="display: none; margin-top: 12px;">
            <button id="subs-btn" style="
              width: 100%; padding: 12px;
              background: #111; color: #fff;
              border: none; border-radius: 8px;
              font-size: 14px; font-weight: 600;
              cursor: pointer; transition: background 0.15s;
            ">
              Subscribe now
            </button>
            <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 8px 0 0;">
              Manage or cancel anytime in your account
            </p>
          </div>
        </div>
      `;

    // ── Event listeners ────────────────────────────────────────────────────

    const radios = container.querySelectorAll('input[name="subs-plan"]');
    const cta = container.querySelector("#subs-cta");
    const btn = container.querySelector("#subs-btn");

    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        selectedPlanId = radio.value === "onetime" ? null : radio.value;

        // Highlight selected option
        radios.forEach((r) => {
          const label = r.closest("label");
          if (label) {
            label.style.borderColor = r.checked
              ? r.value === "onetime"
                ? "#e5e7eb"
                : "#111"
              : "#e5e7eb";
          }
        });

        // Show/hide the subscribe button
        if (cta) {
          cta.style.display = selectedPlanId ? "block" : "none";
        }
      });
    });

    if (btn) {
      btn.addEventListener("click", () => {
        if (!selectedPlanId) return;

        // Build the portal URL with all the context the login page needs
        const params = new URLSearchParams({
          shopId,
          planId: selectedPlanId,
          ...(variantId ? { variantId } : {}),
        });

        const destination = portalUrl
          ? `${portalUrl}/login?${params.toString()}`
          : `/login?${params.toString()}`;

        window.location.href = destination;
      });

      btn.addEventListener("mouseover", () => {
        btn.style.background = "#374151";
      });
      btn.addEventListener("mouseout", () => {
        btn.style.background = "#111";
      });
    }
  }

  // ── Price calculation ──────────────────────────────────────────────────────

  function calcDiscount(price, plan) {
    if (!plan.discountValue || plan.discountValue <= 0) return price;

    const discountAmount =
      plan.discountType === "PERCENTAGE"
        ? (price * plan.discountValue) / 100
        : Math.min(plan.discountValue, price);

    return Math.round((price - discountAmount) * 100) / 100;
  }

  // ── Run on DOM ready ───────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
