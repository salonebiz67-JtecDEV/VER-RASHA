import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useBoutique } from '../../context/BoutiqueContext';

type PolicyModalType = 'privacy' | 'terms' | null;

export const Footer: React.FC = () => {
  const { navigate, storeSettings } = useBoutique();
  const [activePolicy, setActivePolicy] = useState<PolicyModalType>(null);

  return (
    <>
      <footer className="mt-14 border-t border-[#E4D8C5] bg-[#EFE7DA]/65 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-12 lg:gap-10">
          {/* Boutique Description */}
          <div className="lg:col-span-5">
            <p className="font-serif text-xl font-medium tracking-[0.16em] text-[#302923]">
              {storeSettings.boutiqueName}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#665B51]">
              A contemporary women&apos;s fashion house devoted to luminous mulberry silk,
              tailored natural linen, cashmere outerwear, and sculptural leather pieces.
            </p>
            {storeSettings.pickupLocationNote && (
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-[#665B51]">
                {storeSettings.pickupLocationNote}
              </p>
            )}
          </div>

          {/* Shop Categories */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-semibold tracking-[0.16em] text-[#302923] uppercase">
              Shop
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#665B51]">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'dresses' })}
                  className="transition-colors hover:text-[#302923]"
                >
                  Silk Dresses
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'tailoring' })}
                  className="transition-colors hover:text-[#302923]"
                >
                  Tailoring
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'outerwear' })}
                  className="transition-colors hover:text-[#302923]"
                >
                  Outerwear
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'handbags' })}
                  className="transition-colors hover:text-[#302923]"
                >
                  Leather Goods
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'jewellery' })}
                  className="transition-colors hover:text-[#302923]"
                >
                  Fine Jewellery
                </button>
              </li>
            </ul>
          </div>

          {/* Client Services */}
          <div className="lg:col-span-3">
            <h4 className="text-[11px] font-semibold tracking-[0.16em] text-[#302923] uppercase">
              Client Services
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#665B51]">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('account')}
                  className="transition-colors hover:text-[#302923]"
                >
                  Orders &amp; Tracking
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('notifications')}
                  className="transition-colors hover:text-[#302923]"
                >
                  Boutique Updates
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('wishlist')}
                  className="transition-colors hover:text-[#302923]"
                >
                  Saved Wishlist
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('cart')}
                  className="transition-colors hover:text-[#302923]"
                >
                  Shopping Bag
                </button>
              </li>
            </ul>
          </div>

          {/* Policies & Legal */}
          <div className="lg:col-span-2">
            <h4 className="text-[11px] font-semibold tracking-[0.16em] text-[#302923] uppercase">
              Information
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-[#665B51]">
              <li>
                <button
                  type="button"
                  onClick={() => setActivePolicy('privacy')}
                  className="transition-colors hover:text-[#302923]"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setActivePolicy('terms')}
                  className="transition-colors hover:text-[#302923]"
                >
                  Terms &amp; Conditions
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 border-t border-[#E4D8C5] px-4 py-5 text-xs text-[#665B51] sm:flex-row sm:items-center sm:px-6">
          <p>© 2026 {storeSettings.boutiqueName}. All rights reserved.</p>
          <p>Luxury Women&apos;s Fashion Boutique</p>
        </div>
      </footer>

      {activePolicy && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="policy-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#302923]/55 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-[#E4D8C5] pb-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.16em] text-[#8C6D46] uppercase">
                  {storeSettings.boutiqueName}
                </p>
                <h2
                  id="policy-modal-title"
                  className="mt-1 font-serif text-2xl font-medium text-[#302923]"
                >
                  {activePolicy === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                aria-label="Close legal information"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full border border-[#E4D8C5] text-[#302923] hover:bg-[#EFE7DA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#665B51]">
              {activePolicy === 'privacy' ? (
                <>
                  <p>
                    VEY RASHA respects client privacy across every step of browsing and order
                    submission.
                  </p>
                  <p>
                    We never request browser GPS access, device location permissions, or background
                    location tracking. Delivery destinations are collected solely from the address
                    fields you enter manually at checkout.
                  </p>
                  <p>
                    Order contact details and delivery instructions are used exclusively to review
                    availability, confirm delivery fees, coordinate fulfillment, and share order
                    updates.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    All orders placed through VEY RASHA begin as an order request subject to
                    boutique review.
                  </p>
                  <p>
                    Product prices shown reflect garment pricing in the selected display currency.
                    Applicable delivery fees and final order totals are confirmed directly by the
                    boutique after reviewing your manually entered delivery destination.
                  </p>
                  <p>
                    Confirmed orders include an itemized receipt and live fulfillment updates from
                    review through delivery.
                  </p>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="min-h-[42px] rounded-full bg-[#302923] px-6 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase hover:bg-[#463D35]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
