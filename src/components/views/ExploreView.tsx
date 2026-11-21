import React, { useMemo } from 'react';
import { AlertCircle, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { CATEGORIES, PRODUCTS } from '../../data/catalog';
import { type PriceBand, type SortOption, useBoutique } from '../../context/BoutiqueContext';
import { ProductCard } from '../ui/ProductCard';

export const ExploreView: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    priceBand,
    setPriceBand,
    sortBy,
    setSortBy,
    resetExploreFilters,
    isCatalogLoading,
    catalogError,
    retryCatalogLoad,
  } = useBoutique();

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    let list = PRODUCTS.filter((product) => {
      if (activeCategory !== 'all' && product.category !== activeCategory) {
        return false;
      }
      if (priceBand === 'under-450' && product.priceUsd >= 450) return false;
      if (priceBand === '450-900' && (product.priceUsd < 450 || product.priceUsd > 900)) {
        return false;
      }
      if (priceBand === 'over-900' && product.priceUsd <= 900) return false;

      if (q) {
        const haystack = `${product.name} ${product.subtitle} ${product.categoryLabel} ${product.material}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      list = [...list].sort((a, b) => a.priceUsd - b.priceUsd);
    } else if (sortBy === 'price-desc') {
      list = [...list].sort((a, b) => b.priceUsd - a.priceUsd);
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival));
    }

    return list;
  }, [searchQuery, activeCategory, priceBand, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || activeCategory !== 'all' || priceBand !== 'all' || sortBy !== 'featured';

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 md:pt-10">
      <div className="border-b border-[#E4D8C5] pb-6">
        <p className="text-xs font-medium tracking-[0.16em] text-[#8C6D46] uppercase">
          The Boutique Archive
        </p>
        <div className="mt-1 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h1 className="font-serif text-3xl font-medium text-[#302923] sm:text-4xl">
            Explore Collection
          </h1>
          <p className="text-sm text-[#665B51] tabular-nums">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'piece' : 'pieces'} available
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#665B51]"
              strokeWidth={1.6}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by silhouette, silk, linen, or colour..."
              aria-label="Search boutique products"
              className="h-11 w-full rounded-full border border-[#E4D8C5] bg-[#FCF9F4] pr-10 pl-10 text-sm text-[#302923] placeholder:text-[#665B51]/75 focus:border-[#B59972] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-[#665B51] hover:text-[#302923]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Price & Sort Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#665B51]" strokeWidth={1.6} />
              <label htmlFor="price-filter" className="sr-only">
                Price Filter
              </label>
              <select
                id="price-filter"
                value={priceBand}
                onChange={(e) => setPriceBand(e.target.value as PriceBand)}
                className="min-h-[44px] rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 text-xs font-medium text-[#302923] focus:border-[#B59972] focus:outline-none"
              >
                <option value="all">All Prices</option>
                <option value="under-450">Under $450</option>
                <option value="450-900">$450 – $900</option>
                <option value="over-900">Over $900</option>
              </select>
            </div>

            <div>
              <label htmlFor="sort-select" className="sr-only">
                Sort Products
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="min-h-[44px] rounded-full border border-[#E4D8C5] bg-[#FCF9F4] px-4 text-xs font-medium text-[#302923] focus:border-[#B59972] focus:outline-none"
              >
                <option value="featured">Sort: Featured</option>
                <option value="newest">Sort: New Arrivals</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetExploreFilters}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-[#665B51] hover:text-[#302923] whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Filter by category">
          {CATEGORIES.map((category) => {
            const active = activeCategory === category.slug;
            return (
              <button
                key={category.slug}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCategory(category.slug)}
                className={`min-h-[44px] shrink-0 rounded-full px-5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#302923] text-[#F6F1E8]'
                    : 'border border-[#E4D8C5] bg-[#FCF9F4] text-[#665B51] hover:border-[#B59972] hover:text-[#302923]'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error State */}
      {catalogError && (
        <div
          role="alert"
          className="mt-10 flex flex-col items-center rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] px-6 py-12 text-center"
        >
          <AlertCircle className="h-7 w-7 text-[#8C6D46]" strokeWidth={1.5} />
          <h2 className="mt-3 font-serif text-xl font-medium text-[#302923]">
            Collection Temporarily Unavailable
          </h2>
          <p className="mt-1 max-w-md text-sm text-[#665B51]">{catalogError}</p>
          <button
            type="button"
            onClick={retryCatalogLoad}
            className="mt-5 min-h-[44px] rounded-full bg-[#302923] px-6 py-2.5 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Loading Skeleton State */}
      {!catalogError && isCatalogLoading && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="space-y-3">
              <div className="aspect-[4/3] w-full animate-pulse rounded-xl bg-[#EFE7DA]" />
              <div className="h-3 w-24 animate-pulse rounded bg-[#EFE7DA]" />
              <div className="h-5 w-48 animate-pulse rounded bg-[#EFE7DA]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[#EFE7DA]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!catalogError && !isCatalogLoading && filteredProducts.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-[#E4D8C5] bg-[#FCF9F4] px-6 py-16 text-center">
          <p className="font-serif text-2xl font-medium text-[#302923]">
            No matching pieces found
          </p>
          <p className="mt-2 max-w-md text-sm text-[#665B51]">
            Adjust your category, price range, or search terms to explore our full seasonal archive.
          </p>
          <button
            type="button"
            onClick={resetExploreFilters}
            className="mt-6 min-h-[44px] rounded-full bg-[#302923] px-6 py-2.5 text-xs font-medium text-[#F6F1E8] hover:bg-[#463D35]"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Product Grid */}
      {!catalogError && !isCatalogLoading && filteredProducts.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};
