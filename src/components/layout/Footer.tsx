import React from 'react';
import { useBoutique } from '../../context/BoutiqueContext';

export const Footer: React.FC = () => {
  const { navigate } = useBoutique();

  return (
    <footer className="mt-16 border-t border-[#E4D8C5] bg-[#EFE7DA]/60 pb-24 md:pb-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-serif text-xl tracking-[0.14em] text-[#302923]">VEY RASHA</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#665B51]">
            A contemporary women&apos;s fashion boutique dedicated to refined silhouettes, timeless
            tailoring, and curated signature pieces.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wider text-[#302923] uppercase">
            Boutique
          </h4>
          <ul className="mt-3 space-y-2.5 text-sm text-[#665B51]">
            <li>
              <button
                type="button"
                onClick={() => navigate('explore', { category: 'dresses' })}
                className="hover:text-[#302923] transition-colors"
              >
                Silk Dresses
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('explore', { category: 'tailoring' })}
                className="hover:text-[#302923] transition-colors"
              >
                Atelier Tailoring
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('explore', { category: 'handbags' })}
                className="hover:text-[#302923] transition-colors"
              >
                Leather Goods
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('explore', { category: 'jewellery' })}
                className="hover:text-[#302923] transition-colors"
              >
                Fine Jewellery
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold tracking-wider text-[#302923] uppercase">
            Client Services
          </h4>
          <ul className="mt-3 space-y-2.5 text-sm text-[#665B51]">
            <li>
              <button
                type="button"
                onClick={() => navigate('account')}
                className="hover:text-[#302923] transition-colors"
              >
                Orders & Tracking
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('notifications')}
                className="hover:text-[#302923] transition-colors"
              >
                Boutique Updates
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => navigate('wishlist')}
                className="hover:text-[#302923] transition-colors"
              >
                Saved Wishlist
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 border-t border-[#E4D8C5] px-4 py-6 text-xs text-[#665B51] sm:flex-row sm:items-center sm:px-6">
        <p>© 2026 VEY RASHA. All rights reserved.</p>
        <p>VEY RASHA Luxury Women&apos;s Boutique</p>
      </div>
    </footer>
  );
};
