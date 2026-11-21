import React from 'react';
import { Printer, X } from 'lucide-react';
import type { OrderRecord } from '../../types/boutique';
import { formatPrice } from '../../utils/formatCurrency';
import {
  formatOrderDate,
  isOrderConfirmedOrLater,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../utils/orderStatus';

interface PrintableReceiptModalProps {
  order: OrderRecord;
  onClose: () => void;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  order,
  onClose,
}) => {
  const confirmed = isOrderConfirmedOrLater(order.status);
  const documentTitle =
    order.status === 'PENDING_REVIEW'
      ? 'Order Request Summary'
      : order.status === 'CANCELLED'
      ? 'Order Summary — Cancelled'
      : 'Confirmed Receipt';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-document-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#302923]/60 p-4 backdrop-blur-xs sm:p-8"
    >
      <div className="my-auto w-full max-w-2xl rounded-2xl border border-[#D8C3A5] bg-[#FCF9F4] p-5 shadow-2xl sm:p-8">
        {/* Screen-only Action Header */}
        <div className="no-print mb-5 flex items-center justify-between gap-3 border-b border-[#E4D8C5] pb-4">
          <p className="text-xs font-medium tracking-wider text-[#665B51] uppercase">
            Printable Document
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#302923] px-5 py-2 text-xs font-semibold tracking-wider text-[#F6F1E8] uppercase transition-colors hover:bg-[#463D35]"
            >
              <Printer className="h-4 w-4" strokeWidth={1.6} />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt preview"
              className="flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full border border-[#E4D8C5] text-[#302923] hover:bg-[#EFE7DA]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <article id="vey-rasha-printable-receipt" className="space-y-6 text-[#302923]">
          <header className="flex flex-col justify-between gap-4 border-b border-[#D8C3A5] pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="font-serif text-3xl font-medium tracking-[0.16em] text-[#302923]">
                VEY RASHA
              </p>
              <p className="mt-1 text-xs tracking-wider text-[#8C6D46] uppercase">
                Luxury Women&apos;s Fashion Boutique
              </p>
            </div>
            <div className="sm:text-right">
              <h2
                id="receipt-document-title"
                className="font-serif text-2xl font-medium text-[#302923]"
              >
                {documentTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[#665B51] tabular-nums">
                Reference: <strong className="text-[#302923]">{order.orderReference}</strong>
              </p>
            </div>
          </header>

          {/* Order & Status Metadata */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8]/60 p-4 text-xs sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="font-semibold tracking-wider text-[#8C6D46] uppercase">
                Order Details
              </p>
              <p>
                <span className="text-[#665B51]">Order Date: </span>
                <span className="font-medium text-[#302923]">
                  {formatOrderDate(order.createdAt)}
                </span>
              </p>
              <p>
                <span className="text-[#665B51]">Order Status: </span>
                <span className="font-semibold text-[#302923]">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </p>
              <p>
                <span className="text-[#665B51]">Payment Status: </span>
                <span className="font-medium text-[#302923]">
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </span>
              </p>
              {order.estimatedDeliveryTime && (
                <p>
                  <span className="text-[#665B51]">Estimated Delivery: </span>
                  <span className="font-medium text-[#302923]">{order.estimatedDeliveryTime}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold tracking-wider text-[#8C6D46] uppercase">
                Customer &amp; Delivery Address
              </p>
              <p className="font-medium text-[#302923]">{order.customer.fullName}</p>
              <p className="text-[#665B51]">{order.customer.phone}</p>
              <p className="text-[#302923]">{order.customer.deliveryAddress}</p>
              <p className="text-[#665B51]">
                {order.customer.area}, {order.customer.city}, {order.customer.country}
              </p>
              {order.customer.deliveryInstructions && (
                <p className="text-[#665B51]">
                  Instructions: {order.customer.deliveryInstructions}
                </p>
              )}
            </div>
          </div>

          {/* Itemized Products */}
          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-[#8C6D46] uppercase">
              Selected Pieces
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#D8C3A5] text-[11px] font-semibold tracking-wider text-[#665B51] uppercase">
                    <th className="py-2 pr-3">Product</th>
                    <th className="px-2 py-2">Size / Colour</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-right">Price</th>
                    <th className="py-2 pl-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4D8C5]">
                  {order.items.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`}>
                      <td className="py-3 pr-3 font-serif text-base font-medium text-[#302923]">
                        {item.productName}
                      </td>
                      <td className="px-2 py-3 text-xs text-[#665B51]">
                        {item.size} / {item.colorName}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-2 py-3 text-right tabular-nums">
                        {formatPrice(item.unitPriceUsd, order.currencyAtOrder)}
                      </td>
                      <td className="py-3 pl-2 text-right font-medium tabular-nums">
                        {formatPrice(item.lineTotalUsd, order.currencyAtOrder)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="border-t border-[#D8C3A5] pt-4">
            <dl className="ml-auto max-w-sm space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#665B51]">Product Subtotal</dt>
                <dd className="font-medium text-[#302923] tabular-nums">
                  {formatPrice(order.subtotalUsd, order.currencyAtOrder)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#665B51]">
                  {confirmed ? 'Confirmed Delivery Fee' : 'Delivery Fee'}
                </dt>
                <dd className="text-right font-medium text-[#302923] tabular-nums">
                  {order.deliveryFeeUsd !== null
                    ? formatPrice(order.deliveryFeeUsd, order.currencyAtOrder)
                    : 'Pending boutique review'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[#E4D8C5] pt-2.5 text-base font-semibold text-[#302923]">
                <dt>{confirmed ? 'Confirmed Final Total' : 'Final Total'}</dt>
                <dd className="text-right tabular-nums">
                  {order.finalTotalUsd !== null
                    ? formatPrice(order.finalTotalUsd, order.currencyAtOrder)
                    : 'To be confirmed by boutique'}
                </dd>
              </div>
            </dl>

            {order.status === 'PENDING_REVIEW' && (
              <p className="mt-4 rounded-xl border border-[#E4D8C5] bg-[#EFE7DA]/60 p-3.5 text-xs leading-relaxed text-[#665B51]">
                This document is an <strong>Order Request Summary</strong>. Delivery fee and final
                total will be confirmed by VEY RASHA after reviewing your delivery address.
              </p>
            )}

            {order.ownerMessage && (
              <p className="mt-4 rounded-xl border border-[#E4D8C5] bg-[#F6F1E8] p-3.5 text-xs leading-relaxed text-[#302923]">
                <strong className="font-semibold">Boutique Note: </strong>
                {order.ownerMessage}
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
};
