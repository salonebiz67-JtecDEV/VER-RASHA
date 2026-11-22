import React, { useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { ASSETS, CATEGORIES } from '../../data/catalog';
import { useBoutique } from '../../context/BoutiqueContext';
import { formatPrice } from '../../utils/formatCurrency';
import { LuxuryImage } from '../ui/LuxuryImage';
import { ProductCard } from '../ui/ProductCard';

export const HomeView: React.FC = () => {
  const {
    navigate,
    setSearchQuery,
    products,
    collections,
    campaigns,
    currency,
  } = useBoutique();
  const [localSearch, setLocalSearch] = useState('');

  const newArrivals = products.filter((p) => p.isNewArrival).slice(0, 4);
  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 4);
  const visualCategories = CATEGORIES.filter((cat) => cat.slug !== 'all' && cat.image);
  const campaign = campaigns[0];
  const featuredProduct = products[0];

  const liveSearchMatches = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((product) =>
        `${product.name} ${product.subtitle} ${product.categoryLabel} ${product.material}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 4);
  }, [localSearch, products]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(localSearch.trim());
    navigate('explore');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 pt-4 pb-12 sm:space-y-16 sm:px-6 md:space-y-20 md:pt-6">
      {/* Hero Campaign Banner */}
      <section aria-label="Featured Boutique Campaign">
        <div className="relative overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#302923] sm:rounded-3xl">
          <div className="aspect-[3/4] w-full sm:aspect-[16/9] lg:aspect-[16/7.5]">
            <LuxuryImage
              src={ASSETS.heroGown}
              alt="VEY RASHA Autumn-Winter campaign silhouette in flowing champagne evening gown"
              loading="eager"
              className="h-full w-full"
              imgClassName="object-[center_22%]"
            />
          </div>
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#1E1813]/92 via-[#1E1813]/38 to-[#1E1813]/10"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-14">
            <p className="text-[11px] font-medium tracking-[0.2em] text-[#D8C3A5] uppercase sm:text-xs">
              Autumn — Winter Collection
            </p>
            <h1 className="mt-2 max-w-xl font-serif text-4xl font-normal leading-[1.05] text-[#F6F1E8] sm:text-5xl lg:text-6xl">
              Quiet Elegance in Motion
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#F6F1E8]/85 sm:text-base">
              Evening gowns, structured tailoring, and signature accessories designed with timeless
              feminine restraint.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('explore', { category: 'all' })}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[#D8C3A5]/70 bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase shadow-sm transition-all duration-150 hover:bg-[#463D35] active:scale-[0.98] whitespace-nowrap"
              >
                <span>Shop Collection</span>
                <ArrowRight className="h-4 w-4 text-[#D8C3A5]" strokeWidth={1.75} />
              </button>
              {featuredProduct && (
                <button
                  type="button"
                  onClick={() => navigate('product', { productId: featuredProduct.id })}
                  className="inline-flex min-h-[46px] items-center rounded-full border border-[#F6F1E8]/45 bg-[#302923]/45 px-6 py-3 text-xs font-medium tracking-[0.12em] text-[#F6F1E8] uppercase backdrop-blur-sm transition-colors duration-150 hover:bg-[#302923]/75 active:scale-[0.98] whitespace-nowrap"
                >
                  Featured Gown
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Boutique Search Bar with Live Preview */}
      <section aria-label="Boutique Search" className="!mt-7 sm:!mt-10">
        <div className="relative mx-auto max-w-2xl">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#665B51]"
              strokeWidth={1.6}
            />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search dresses, tailoring, handbags..."
              aria-label="Search boutique pieces"
              className="h-12 w-full rounded-full border border-[#E4D8C5] bg-[#FCF9F4] pr-36 pl-11 text-sm text-[#302923] placeholder:text-[#665B51]/80 transition-colors focus:border-[#B59972] focus:outline-none"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                aria-label="Clear search query"
                className="absolute top-1/2 right-24 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#665B51] hover:text-[#302923]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute top-1.5 right-1.5 min-h-[36px] rounded-full bg-[#302923] px-5 py-2 text-xs font-medium tracking-wide text-[#F6F1E8] transition-colors duration-150 hover:bg-[#463D35] active:scale-[0.98] whitespace-nowrap"
            >
              Search
            </button>
          </form>

          {localSearch.trim() !== '' && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] shadow-sm">
              {liveSearchMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-[#665B51] sm:flex-row">
                  <span>No pieces match &ldquo;{localSearch.trim()}&rdquo;.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalSearch('');
                      setSearchQuery('');
                      navigate('explore', { category: 'all' });
                    }}
                    className="font-semibold text-[#302923] underline decoration-[#B59972] underline-offset-4"
                  >
                    Browse Full Catalogue
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-[#E4D8C5]">
                  {liveSearchMatches.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigate('product', { productId: item.id })}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#EFE7DA]/60"
                      >
                        <div className="aspect-[4/5] w-10 shrink-0 overflow-hidden rounded-lg bg-[#EFE7DA]">
                          <LuxuryImage
                            src={item.images[0]}
                            alt={item.name}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-base font-medium text-[#302923]">
                            {item.name}
                          </p>
                          <p className="truncate text-[11px] text-[#665B51]">
                            {item.categoryLabel}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-[#302923] tabular-nums">
                          {formatPrice(item.priceUsd, currency)}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(localSearch.trim());
                        navigate('explore');
                      }}
                      className="flex w-full items-center justify-center gap-1.5 bg-[#F6F1E8]/80 px-4 py-2.5 text-xs font-semibold tracking-wider text-[#302923] uppercase hover:bg-[#EFE7DA]"
                    >
                      <span>View All Results in Shop</span>
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {products.length === 0 ? (
        <section className="rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
          <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
            Seasonal Atelier
          </p>
          <h2 className="mt-2 font-serif text-3xl font-medium text-[#302923]">
            New Collections Coming Soon
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#665B51]">
            Our upcoming curated pieces are currently being prepared for release. Check Boutique
            Updates for launch announcements.
          </p>
        </section>
      ) : (
        <>
          {/* Visual Category Collections */}
          <section aria-label="Shop by Category">
            <div className="flex items-end justify-between gap-4 border-b border-[#E4D8C5] pb-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                  Curated Wardrobe
                </p>
                <h2 className="mt-1 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                  Shop by Category
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('explore', { category: 'all' })}
                className="min-h-[44px] inline-flex items-center text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase underline decoration-[#B59972] underline-offset-4 transition-colors hover:text-[#8C6D46] whitespace-nowrap shrink-0"
              >
                View All
              </button>
            </div>

            <div className="mt-6 flex gap-3.5 overflow-x-auto pb-2 no-scrollbar lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:pb-0">
              {visualCategories.map((cat) => {
                const itemCount = products.filter((p) => p.category === cat.slug).length;
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => navigate('explore', { category: cat.slug })}
                    className="group flex w-[142px] shrink-0 flex-col text-left transition-transform duration-150 active:scale-[0.98] lg:w-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#302923]"
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-[#E4D8C5] bg-[#EFE7DA]">
                      <LuxuryImage
                        src={cat.image!}
                        alt={cat.label}
                        className="h-full w-full"
                        imgClassName="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                      />
                    </div>
                    <span className="mt-2.5 font-serif text-base font-medium text-[#302923] transition-colors group-hover:text-[#8C6D46]">
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-[#665B51] tabular-nums">
                      {itemCount} {itemCount === 1 ? 'piece' : 'pieces'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* New Arrivals */}
          {newArrivals.length > 0 && (
            <section aria-label="New Arrivals">
              <div className="flex items-end justify-between gap-4 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                    Latest Releases
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    New Arrivals
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'all' })}
                  className="min-h-[44px] inline-flex items-center text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase underline decoration-[#B59972] underline-offset-4 transition-colors hover:text-[#8C6D46] whitespace-nowrap shrink-0"
                >
                  Browse Shop
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
                {newArrivals.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* Featured Collections */}
          {collections.length > 0 && (
            <section aria-label="Featured Collections">
              <div className="flex items-end justify-between gap-4 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                    Curated Edits
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    Featured Collections
                  </h2>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
                {collections.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => navigate('explore', { category: col.filterCategory })}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] text-left transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(48,41,35,0.2)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#302923]"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[#EFE7DA]">
                      <LuxuryImage
                        src={col.image}
                        alt={col.title}
                        className="h-full w-full"
                        imgClassName="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.035]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                      <div>
                        <p className="text-[11px] font-medium tracking-[0.14em] text-[#8C6D46] uppercase">
                          {col.season}
                        </p>
                        <h3 className="mt-1.5 font-serif text-2xl font-medium text-[#302923]">
                          {col.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-[#665B51] line-clamp-2">
                          {col.summary}
                        </p>
                      </div>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase transition-colors group-hover:text-[#8C6D46]">
                        <span>Shop Capsule</span>
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                          strokeWidth={1.75}
                        />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Editorial Campaign Feature */}
          {campaign && (
            <section aria-label="Featured Editorial Campaign">
              <div className="grid overflow-hidden rounded-2xl border border-[#E4D8C5] bg-[#EFE7DA] sm:rounded-3xl lg:grid-cols-12 lg:items-stretch">
                <div className="lg:col-span-7">
                  <div className="aspect-[16/10] h-full w-full lg:aspect-auto">
                    <LuxuryImage src={campaign.image} alt={campaign.title} className="h-full w-full" />
                  </div>
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-5 lg:p-12">
                  <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                    {campaign.kicker}
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-medium leading-tight text-[#302923] sm:text-3xl lg:text-4xl">
                    {campaign.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-[#665B51] sm:text-[15px]">
                    {campaign.description}
                  </p>
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => navigate('explore', { category: campaign.targetCategory })}
                      className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#302923] px-7 py-3 text-xs font-semibold tracking-[0.14em] text-[#F6F1E8] uppercase transition-colors duration-150 hover:bg-[#463D35] active:scale-[0.98] whitespace-nowrap"
                    >
                      <span>{campaign.ctaLabel}</span>
                      <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Best Sellers */}
          {bestSellers.length > 0 && (
            <section aria-label="Best Sellers">
              <div className="flex items-end justify-between gap-4 border-b border-[#E4D8C5] pb-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.18em] text-[#8C6D46] uppercase">
                    Signature Silhouettes
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-medium text-[#302923] sm:text-3xl">
                    Best Sellers
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('explore', { category: 'all' })}
                  className="min-h-[44px] inline-flex items-center text-xs font-semibold tracking-[0.12em] text-[#302923] uppercase underline decoration-[#B59972] underline-offset-4 transition-colors hover:text-[#8C6D46] whitespace-nowrap shrink-0"
                >
                  Shop All Pieces
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4">
                {bestSellers.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
